// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPriceOracle} from "./PriceOracle.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getReserveNormalizedIncome(address asset) external view returns (uint256);
}

contract Torito is Ownable {
    // Enums
    enum SupplyStatus { INACTIVE, ACTIVE }
    enum BorrowStatus { INACTIVE, ACTIVE, REPAID, LIQUIDATED }
    enum RequestStatus { PENDING, PROCESSED, CANCELED }

    // Structs
    struct Supply {
        uint256 supplyId;             // unique identifier for this supply
        address owner;
        uint256 scaledBalance;
        address asset;
        uint256 usedCollateral;       // amount of collateral currently locked by borrows
        SupplyStatus status;
    }

    struct Borrow {
        uint256 borrowId;             // unique identifier for this borrow
        address owner;
        uint256 borrowedAmount;       // scaled by borrowIndex (includes interest)
        address collateralAsset;
        bytes32 fiatCurrency;
        uint256 totalRepaid;
        uint256 lockedCollateralAsset; // collateral locked for this borrow (in asset units)
        BorrowStatus status;
    }

    struct BorrowRequest {
        uint256 requestId;
        address owner;
        address collateralAsset;
        bytes32 fiatCurrency;
        uint256 borrowAmount; // in currency units (not scaled)
        RequestStatus status;
    }

    struct Asset {
        address assetAddress;
        uint8 decimals;
        bool isSupported;
    }

    struct FiatCurrency {
        bytes32 currency;
        uint8 decimals;                    // Currency decimals (e.g., 18 for BOB)
        uint256 collateralizationRatio;
        uint256 liquidationThreshold;
        address oracle;

        /// 🔑 Dynamic interest config
        uint256 baseRate;      
        uint256 minRate;
        uint256 maxRate;
        uint256 sensitivity;

        /// 🔑 Borrow index tracking
        uint256 borrowIndex; 
        uint256 lastUpdateBorrowIndex;     
    }

    uint256 constant RAY = 1e27;

    // Storage
    mapping(uint256 => Supply) public supplies; // supplyId => supply
    mapping(uint256 => Borrow) public borrows; // borrowId => borrow (active positions)
    mapping(uint256 => BorrowRequest) public borrowRequests; // requestId => request
    mapping(address => Asset) public supportedAssets; // token => asset info
    mapping(bytes32 => FiatCurrency) public supportedCurrencies;
    
    mapping(address => uint256) public userNonces; // user => nonce counter

    IAavePool public aavePool;

    // Events
    event SupplyCreated(uint256 indexed supplyId, address indexed user, address token, uint256 amount);
    event SupplyDeposited(uint256 indexed supplyId, address indexed user, address token, uint256 amount, uint256 totalAmount);
    event SupplyWithdrawn(uint256 indexed supplyId, address indexed user, address token, uint256 amount, uint256 totalAmount);
    event BorrowRequestCreated(uint256 indexed requestId, address indexed user, address collateralAsset, bytes32 currency, uint256 amount);
    event BorrowRequestProcessed(uint256 indexed requestId, uint256 indexed borrowId, address indexed user, bytes32 currency, uint256 amount, uint256 lockedCollateralAsset);
    event BorrowRequestCanceled(uint256 indexed requestId, address indexed user, bytes32 currency);
    event BorrowUpdated(uint256 indexed borrowId, address indexed user, bytes32 currency, uint256 amount, uint256 totalAmount);
    event LoanRepaid(uint256 indexed borrowId, address indexed user, bytes32 currency, uint256 amount, uint256 remainingAmount);
    event CollateralLiquidated(uint256 indexed borrowId, address indexed user, uint256 collateralAmount);

    constructor(address _aavePool, address _owner) Ownable(_owner) {
        aavePool = IAavePool(_aavePool);
    }

    // --- Admin ---
    function addSupportedAsset(address assetAddr, uint8 decimals, bool supported) external onlyOwner {
        supportedAssets[assetAddr] = Asset({
            assetAddress: assetAddr,
            decimals: decimals,
            isSupported: supported
        });
    }

    function updateSupportedAsset(address assetAddr, uint8 decimals, bool supported) external onlyOwner {
        require(supportedAssets[assetAddr].assetAddress != address(0), "Asset not supported");
        supportedAssets[assetAddr].decimals = decimals;
        supportedAssets[assetAddr].isSupported = supported;
    }

    function addSupportedCurrency(
        bytes32 currency,
        uint8 decimals,
        address oracle,
        uint256 collateralizationRatio,
        uint256 liquidationThreshold,
        uint256 baseRate,
        uint256 minRate,
        uint256 maxRate,
        uint256 sensitivity
    ) external onlyOwner {
        require(collateralizationRatio >= 100e16, "collat >= 100%");
        require(liquidationThreshold >= 100e16, "liq >= 100%");
        require(liquidationThreshold <= collateralizationRatio, "liq <= collat");
        require(decimals <= 18, "decimals <= 18");

        supportedCurrencies[currency] = FiatCurrency({
            currency: currency,
            decimals: decimals,
            oracle: oracle,
            collateralizationRatio: collateralizationRatio,
            liquidationThreshold: liquidationThreshold,
            baseRate: baseRate,
            minRate: minRate,
            maxRate: maxRate,
            sensitivity: sensitivity,
            borrowIndex: RAY,        /// 🔑 start index
            lastUpdateBorrowIndex: block.timestamp
        });
    }

    function updateSupportedCurrency(
        bytes32 currency,
        uint8 decimals,
        address oracle,
        uint256 collateralizationRatio,
        uint256 liquidationThreshold,
        uint256 baseRate,
        uint256 minRate,
        uint256 maxRate,
        uint256 sensitivity
    ) external onlyOwner {
        require(supportedCurrencies[currency].currency != bytes32(0), "Currency not supported");
        require(collateralizationRatio >= 100e16, "collat >= 100%");
        require(liquidationThreshold >= 100e16, "liq >= 100%");
        require(liquidationThreshold <= collateralizationRatio, "liq <= collat");
        require(decimals <= 18, "decimals <= 18");

        supportedCurrencies[currency].decimals = decimals;
        supportedCurrencies[currency].oracle = oracle;
        supportedCurrencies[currency].collateralizationRatio = collateralizationRatio;
        supportedCurrencies[currency].liquidationThreshold = liquidationThreshold;
        supportedCurrencies[currency].baseRate = baseRate;
        supportedCurrencies[currency].minRate = minRate;
        supportedCurrencies[currency].maxRate = maxRate;
        supportedCurrencies[currency].sensitivity = sensitivity;
    }

    modifier hasSupply(uint256 supplyId) {
        require(supplies[supplyId].owner != address(0), "no supply");
        _;
    }

    modifier hasRequestPending(uint256 requestId) {
        require(borrowRequests[requestId].status == RequestStatus.PENDING, "not pending");
        _;
    }

    modifier hasBorrowActive(uint256 borrowId) {
        require(borrows[borrowId].status == BorrowStatus.ACTIVE, "not active");
        _;
    }

    // --- Interest model ---
    /// 🔑 Compute dynamic rate for a currency using linear interpolation
    function dynamicBorrowRate(bytes32 currency, address collateralAsset) public view returns (uint256) {
        FiatCurrency storage fc = supportedCurrencies[currency];
        if (fc.oracle == address(0)) return fc.baseRate;

        uint256 bobPriceUSD = convertCurrencyToAsset(fc.currency, 1e18, collateralAsset);
        if (bobPriceUSD == 0) return fc.baseRate;

        // Linear interpolation: when BOB down = rates down, BOB up = rates up
        // We add to baseRate when BOB price increases
        // Use safe math to prevent underflow when bobPriceUSD < 1e18
        uint256 rate;
        if (bobPriceUSD >= 1e18) {
            rate = fc.baseRate + ((bobPriceUSD - 1e18) * fc.sensitivity) / 1e18;
        } else {
            // When price is below 1e18, subtract from base rate (but don't go below minRate)
            uint256 reduction = ((1e18 - bobPriceUSD) * fc.sensitivity) / 1e18;
            rate = fc.baseRate > reduction ? fc.baseRate - reduction : fc.minRate;
        }
        
        return rate > fc.maxRate ? fc.maxRate : (rate < fc.minRate ? fc.minRate : rate);
    }

    /// 🔑 Update borrowIndex per currency
    function updateBorrowIndex(bytes32 currency, address collateralAsset) public {
        FiatCurrency storage fc = supportedCurrencies[currency];
        uint256 elapsed = block.timestamp - fc.lastUpdateBorrowIndex;
        if (elapsed == 0) return;

        uint256 currentRate = dynamicBorrowRate(currency, collateralAsset);

        fc.borrowIndex = (fc.borrowIndex * (RAY + (currentRate * elapsed) / 365 days)) / RAY;
        fc.lastUpdateBorrowIndex = block.timestamp;
    }

    // --- Supply ---
    function supply(address asset, uint256 amount) external {
        require(supportedAssets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount > 0");

        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        uint256 currentIndex = aavePool.getReserveNormalizedIncome(asset);

        IERC20(asset).approve(address(aavePool), amount);
        aavePool.supply(asset, amount, address(this), 0);

        // Create unique supply ID using user address and token
        uint256 supplyId = uint256(keccak256(abi.encodePacked(msg.sender, asset)));
        
        Supply storage userSupply = supplies[supplyId];
        if (userSupply.owner == address(0)) {
            // New supply
            userSupply.supplyId = supplyId;
            userSupply.owner = msg.sender;
            userSupply.asset = asset;
            userSupply.status = SupplyStatus.ACTIVE;
            userSupply.scaledBalance = (amount * RAY) / currentIndex;
            
            // Add supplyId to user's supply list
            // userSupplies[msg.sender].push(supplyId);
            
            emit SupplyCreated(supplyId, msg.sender, asset, amount);
        } else {
            // Existing supply - add to balance
            userSupply.scaledBalance += (amount * RAY) / currentIndex;
            uint256 userBalance = (userSupply.scaledBalance * currentIndex) / RAY;
            emit SupplyDeposited(supplyId, msg.sender, asset, amount, userBalance);
        }
    }

    // --- Borrow Requests ---
    function borrow(address collateralAsset, uint256 borrowAmount, bytes32 fiatCurrency)
        external
    {
        require(supportedCurrencies[fiatCurrency].currency != bytes32(0), "Currency not supported");

        // Must have an active supply for the collateral asset
        uint256 supplyId = uint256(keccak256(abi.encodePacked(msg.sender, collateralAsset)));
        require(supplies[supplyId].owner != address(0), "no supply");
        require(supplies[supplyId].status == SupplyStatus.ACTIVE, "supply not active");

        // Create borrow request (no collateral is locked yet)
        uint256 requestId = uint256(keccak256(abi.encodePacked(msg.sender, collateralAsset, fiatCurrency, userNonces[msg.sender]++)));
        BorrowRequest storage req = borrowRequests[requestId];
        req.requestId = requestId;
        req.owner = msg.sender;
        req.collateralAsset = collateralAsset;
        req.fiatCurrency = fiatCurrency;
        req.borrowAmount = borrowAmount;
        req.status = RequestStatus.PENDING;

        emit BorrowRequestCreated(requestId, msg.sender, collateralAsset, fiatCurrency, borrowAmount);
    }

    function processBorrowRequest(uint256 requestId) public onlyOwner hasRequestPending(requestId) {
        _processBorrowRequest(requestId);
    }

    function _processBorrowRequest(uint256 requestId) internal {
        BorrowRequest storage req = borrowRequests[requestId];

        // Sync interest for this currency
        updateBorrowIndex(req.fiatCurrency, req.collateralAsset);

        // 1) Validate collateral and compute the exact amount to lock
        uint256 requiredCollateralAsset;
        {
            uint256 supplyId = uint256(keccak256(abi.encodePacked(req.owner, req.collateralAsset)));
            Supply storage userSupply = supplies[supplyId];
            require(userSupply.owner != address(0), "no supply");
            require(userSupply.status == SupplyStatus.ACTIVE, "supply not active");

            uint256 borrowValueAsset = convertCurrencyToAsset(req.fiatCurrency, req.borrowAmount, req.collateralAsset);
            requiredCollateralAsset = (borrowValueAsset * supportedCurrencies[req.fiatCurrency].collateralizationRatio) / 1e18;

            uint256 currentIndex = aavePool.getReserveNormalizedIncome(req.collateralAsset);
            uint256 totalCollateral = (userSupply.scaledBalance * currentIndex) / RAY;
            uint256 availableCollateral = totalCollateral > userSupply.usedCollateral ? totalCollateral - userSupply.usedCollateral : 0;
            require(availableCollateral >= requiredCollateralAsset, "insufficient collateral");
        }

        // 2) Upsert active borrow per (user, collateralAsset, fiatCurrency)
        uint256 borrowId = uint256(keccak256(abi.encodePacked(req.owner, req.collateralAsset, req.fiatCurrency)));
        Borrow storage b = borrows[borrowId];
        if (b.owner == address(0)) {
            b.borrowId = borrowId;
            b.owner = req.owner;
            b.collateralAsset = req.collateralAsset;
            b.fiatCurrency = req.fiatCurrency;
            b.totalRepaid = 0;
            b.borrowedAmount = 0;
            b.lockedCollateralAsset = 0;
            b.status = BorrowStatus.ACTIVE;
        } else if (b.status != BorrowStatus.ACTIVE) {
            // Reset and reactivate if previously closed
            b.totalRepaid = 0;
            b.borrowedAmount = 0;
            b.lockedCollateralAsset = 0;
            b.status = BorrowStatus.ACTIVE;
        }

        // 3) Add to position and lock collateral
        b.borrowedAmount += (req.borrowAmount * RAY) / supportedCurrencies[req.fiatCurrency].borrowIndex;
        b.lockedCollateralAsset += requiredCollateralAsset;
        {
            uint256 supplyId2 = uint256(keccak256(abi.encodePacked(req.owner, req.collateralAsset)));
            supplies[supplyId2].usedCollateral += requiredCollateralAsset;
        }

        // 4) Finalize
        req.status = RequestStatus.PROCESSED;
        emit BorrowRequestProcessed(requestId, borrowId, req.owner, req.fiatCurrency, req.borrowAmount, requiredCollateralAsset);
        emit BorrowUpdated(
            borrowId,
            req.owner,
            req.fiatCurrency,
            req.borrowAmount,
            (b.borrowedAmount * supportedCurrencies[req.fiatCurrency].borrowIndex) / RAY - b.totalRepaid
        );
    }

    function processBorrowRequests(uint256[] calldata requestIds) external onlyOwner {
        require(requestIds.length > 0, "Empty array");
        require(requestIds.length <= 50, "Too many requests"); // Gas limit protection
        for (uint256 i = 0; i < requestIds.length; i++) {
            uint256 rid = requestIds[i];
            require(borrowRequests[rid].owner != address(0), "Request not found");
            require(borrowRequests[rid].status == RequestStatus.PENDING, "Request not pending");
            _processBorrowRequest(rid);
        }
    }

    function cancelBorrowRequest(uint256 requestId) external onlyOwner hasRequestPending(requestId) {
        BorrowRequest storage req = borrowRequests[requestId];
        req.status = RequestStatus.CANCELED;
        emit BorrowRequestCanceled(requestId, req.owner, req.fiatCurrency);
    }

    function cancelBorrowRequests(uint256[] calldata requestIds) external onlyOwner {
        require(requestIds.length > 0, "Empty array");
        require(requestIds.length <= 50, "Too many requests"); // Gas limit protection
        for (uint256 i = 0; i < requestIds.length; i++) {
            uint256 rid = requestIds[i];
            require(borrowRequests[rid].owner != address(0), "Request not found");
            require(borrowRequests[rid].status == RequestStatus.PENDING, "Request not pending");
            BorrowRequest storage req = borrowRequests[rid];
            req.status = RequestStatus.CANCELED;
            emit BorrowRequestCanceled(rid, req.owner, req.fiatCurrency);
        }
    }

    // --- Repay ---
    function repayLoan(uint256 borrowId, uint256 repaymentAmount) external hasBorrowActive(borrowId) {
        Borrow storage loan = borrows[borrowId];
        require(loan.owner == msg.sender, "not your borrow");
        
        updateBorrowIndex(loan.fiatCurrency, loan.collateralAsset);  /// 🔑 sync

        uint256 currentDebt = (loan.borrowedAmount * supportedCurrencies[loan.fiatCurrency].borrowIndex) / RAY;
        uint256 outstanding = currentDebt - loan.totalRepaid;
        require(repaymentAmount <= outstanding, "exceeds owed");

        // Proportional collateral release based on repayment against outstanding
        uint256 release = loan.lockedCollateralAsset == 0 ? 0 : (loan.lockedCollateralAsset * repaymentAmount) / outstanding;
        if (release > 0) {
            uint256 supplyId = uint256(keccak256(abi.encodePacked(msg.sender, loan.collateralAsset)));
            Supply storage userSupply = supplies[supplyId];
            if (release > loan.lockedCollateralAsset) release = loan.lockedCollateralAsset;
            loan.lockedCollateralAsset -= release;
            if (release > userSupply.usedCollateral) {
                userSupply.usedCollateral = 0;
            } else {
                userSupply.usedCollateral -= release;
            }
        }

        loan.totalRepaid += repaymentAmount;

        uint256 remaining = outstanding - repaymentAmount;
        if (remaining == 0) {
            loan.status = BorrowStatus.REPAID;
            loan.lockedCollateralAsset = 0;
        }

        emit LoanRepaid(borrowId, msg.sender, loan.fiatCurrency, repaymentAmount, remaining);
    }

    // --- Liquidation ---
    function liquidate(uint256 borrowId) external hasBorrowActive(borrowId) {
        Borrow storage loan = borrows[borrowId];

        uint256 supplyId = uint256(keccak256(abi.encodePacked(loan.owner, loan.collateralAsset)));
        Supply storage userSupply = supplies[supplyId];
        uint256 currentIndex = aavePool.getReserveNormalizedIncome(loan.collateralAsset);
        uint256 collateralValueAsset = (userSupply.scaledBalance * currentIndex) / RAY;

        uint256 threshold = supportedCurrencies[loan.fiatCurrency].liquidationThreshold;

        uint256 outstanding = (loan.borrowedAmount * supportedCurrencies[loan.fiatCurrency].borrowIndex) / RAY
            - loan.totalRepaid;
        
        // Convert outstanding BOB debt to asset
        uint256 debtValueAsset = convertCurrencyToAsset(loan.fiatCurrency, outstanding, loan.collateralAsset);
        uint256 ratio = (collateralValueAsset * 1e18) / debtValueAsset;

        require(ratio < threshold, "not liquidatable");

        loan.status = BorrowStatus.LIQUIDATED;
        
        uint256 released = loan.lockedCollateralAsset;
        loan.lockedCollateralAsset = 0;
        if (released > userSupply.usedCollateral) {
            userSupply.usedCollateral = 0;
        } else {
            userSupply.usedCollateral -= released;
        }
        
        emit CollateralLiquidated(borrowId, loan.owner, released);
    }

    function withdrawSupply(uint256 supplyId, uint256 withdrawAmount) external hasSupply(supplyId) {
        Supply storage userSupply = supplies[supplyId];
        require(userSupply.owner == msg.sender, "not your supply");
        require(userSupply.status == SupplyStatus.ACTIVE, "supply not active");

        // Simple and efficient collateral check - no loops needed!
        uint256 currentIndex = aavePool.getReserveNormalizedIncome(userSupply.asset);
        uint256 totalCollateral = (userSupply.scaledBalance * currentIndex) / RAY;
        uint256 availableCollateral = totalCollateral > userSupply.usedCollateral ? totalCollateral - userSupply.usedCollateral : 0;
        require(withdrawAmount <= availableCollateral, "Insufficient available collateral");

        userSupply.scaledBalance -= (withdrawAmount * RAY) / currentIndex;
        IERC20(userSupply.asset).transfer(msg.sender, withdrawAmount);
        uint256 userBalance = (userSupply.scaledBalance * currentIndex) / RAY;
        emit SupplyWithdrawn(supplyId, msg.sender, userSupply.asset, withdrawAmount, userBalance);
    }

    // Convert FROM currency TO asset with proper decimal handling
    // Price represents: how much currency per 1 unit of asset
    // Example: price = 1257 means 12.57 BOB per 1 USD (with currencyDecimals precision)
    function convertCurrencyToAsset(bytes32 currency, uint256 amount, address collateralAsset) public view returns (uint256) {
        FiatCurrency storage fc = supportedCurrencies[currency];
        require(fc.currency != bytes32(0), "Currency not supported");
        
        uint256 price = IPriceOracle(fc.oracle).getPrice(currency);
        require(price > 0, "Price cannot be zero");
        
        // Get asset decimals
        uint8 assetDecimals = supportedAssets[collateralAsset].decimals;
        
        // Convert: amount (in currencyDecimals) ÷ price (in currencyDecimals) = result (in assetDecimals)
        // Example: 10000 (100.00 BOB) ÷ 1257 (12.57 BOB/USD) = 7.95 USD = 795 cents
        // Formula: (amount × 10^assetDecimals) ÷ price
        
        uint256 result = (amount * (10 ** assetDecimals)) / price;
        
        return result;
    }

    // Convert FROM asset TO currency with proper decimal handling
    // Price represents: how much currency per 1 unit of asset
    // Example: price = 1257 means 12.57 BOB per 1 USD (with currencyDecimals precision)
    function convertAssetToCurrency(bytes32 currency, uint256 assetAmount, address collateralAsset) public view returns (uint256) {
        FiatCurrency storage fc = supportedCurrencies[currency];
        require(fc.currency != bytes32(0), "Currency not supported");
        
        uint256 price = IPriceOracle(fc.oracle).getPrice(currency);
        require(price > 0, "Price cannot be zero");
        
        // Get asset decimals
        uint8 assetDecimals = supportedAssets[collateralAsset].decimals;
        
        // Convert: assetAmount (in assetDecimals) × price (in currencyDecimals) = result (in currencyDecimals)
        // Example: 795 (7.95 USD) × 1257 (12.57 BOB/USD) = 99.93 BOB = 9993 in raw
        // Formula: (assetAmount × price) ÷ 10^assetDecimals
        
        uint256 result = (assetAmount * price) / (10 ** assetDecimals);
        
        return result;
    }
}