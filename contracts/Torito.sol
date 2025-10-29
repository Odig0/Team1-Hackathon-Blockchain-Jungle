// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPriceOracle} from "./PriceOracle.sol";
import {console} from "forge-std/Test.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getReserveNormalizedIncome(address asset) external view returns (uint256);
}

contract Torito is Ownable {
    // Enums
    enum SupplyStatus { INACTIVE, ACTIVE }
    enum BorrowStatus { INACTIVE, REQUESTED, PROCESSED, CANCELED, REPAID, LIQUIDATED }

    // Structs
    struct Supply {
        uint256 supplyId;             // unique identifier for this supply
        address owner;
        uint256 scaledBalance;
        address asset;
        SupplyStatus status;
    }

    struct Borrow {
        uint256 borrowId;             // unique identifier for this borrow
        address owner;
        uint256 borrowedAmount;       // scaled by borrowIndex (includes interest)
        address collateralAsset;
        bytes32 fiatCurrency;
        uint256 totalRepaid;
        BorrowStatus status;
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
    mapping(uint256 => Borrow) public borrows; // borrowId => borrow
    mapping(address => uint256[]) public userSupplies; // user => array of supplyIds
    mapping(address => uint256[]) public userBorrows; // user => array of borrowIds
    mapping(address => Asset) public supportedAssets; // token => asset info
    mapping(bytes32 => FiatCurrency) public supportedCurrencies;
    
    mapping(address => uint256) public userNonces; // user => nonce counter

    IAavePool public aavePool;

    // Events
    event SupplyCreated(uint256 indexed supplyId, address indexed user, address token, uint256 amount);
    event SupplyDeposited(uint256 indexed supplyId, address indexed user, address token, uint256 amount, uint256 totalAmount);
    event SupplyWithdrawn(uint256 indexed supplyId, address indexed user, address token, uint256 amount, uint256 totalAmount);
    event BorrowCreated(uint256 indexed borrowId, address indexed user, bytes32 currency, uint256 amount);
    event BorrowUpdated(uint256 indexed borrowId, address indexed user, bytes32 currency, uint256 amount, uint256 totalAmount);
    event LoanRepaid(uint256 indexed borrowId, address indexed user, bytes32 currency, uint256 amount, uint256 remainingAmount);
    event CollateralLiquidated(uint256 indexed borrowId, address indexed user, uint256 collateralAmount);
    event BorrowProcessed(uint256 indexed borrowId, address indexed user, bytes32 currency);
    event BorrowCanceled(uint256 indexed borrowId, address indexed user, bytes32 currency);

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

    modifier hasBorrowRequested(uint256 borrowId) {
        require(borrows[borrowId].status == BorrowStatus.REQUESTED, "not requested");
        _;
    }

    modifier hasBorrowProcessed(uint256 borrowId) {
        require(borrows[borrowId].status == BorrowStatus.PROCESSED, "not processed");
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
            userSupplies[msg.sender].push(supplyId);
            
            emit SupplyCreated(supplyId, msg.sender, asset, amount);
        } else {
            // Existing supply - add to balance
            userSupply.scaledBalance += (amount * RAY) / currentIndex;
            uint256 userBalance = (userSupply.scaledBalance * currentIndex) / RAY;
            emit SupplyDeposited(supplyId, msg.sender, asset, amount, userBalance);
        }
    }

    // --- Borrow ---
    function borrow(address collateralAsset, uint256 borrowAmount, bytes32 fiatCurrency)
        external
    {
        require(supportedCurrencies[fiatCurrency].currency != bytes32(0), "Currency not supported");
        updateBorrowIndex(fiatCurrency, collateralAsset);  /// 🔑 sync interest

        // Get the supply ID for this user and asset
        uint256 supplyId = uint256(keccak256(abi.encodePacked(msg.sender, collateralAsset)));
        require(supplies[supplyId].owner != address(0), "no supply");
        require(supplies[supplyId].status == SupplyStatus.ACTIVE, "supply not active");

        Supply storage userSupply = supplies[supplyId];

        uint256 borrowValueAsset = convertCurrencyToAsset(fiatCurrency, borrowAmount, collateralAsset);
        uint256 requiredCollateralAsset = (borrowValueAsset * supportedCurrencies[fiatCurrency].collateralizationRatio) / 1e18;

        console.log("borrowValueAsset", borrowValueAsset);
        console.log("collateralizationRatio", supportedCurrencies[fiatCurrency].collateralizationRatio);

        uint256 currentIndex = aavePool.getReserveNormalizedIncome(collateralAsset);
        uint256 collateralValueAsset = (userSupply.scaledBalance * currentIndex) / RAY;
        console.log("collateralValueAsset", collateralValueAsset);
        console.log("requiredCollateralAsset", requiredCollateralAsset);
        require(collateralValueAsset >= requiredCollateralAsset, "insufficient collateral");

        // Create new borrow with unique ID using user's nonce and collateral asset
        uint256 borrowId = uint256(keccak256(abi.encodePacked(msg.sender, collateralAsset, userNonces[msg.sender]++)));
        
        Borrow storage newBorrow = borrows[borrowId];
        newBorrow.borrowId = borrowId;
        newBorrow.owner = msg.sender;
        newBorrow.fiatCurrency = fiatCurrency;
        newBorrow.collateralAsset = collateralAsset;
        newBorrow.status = BorrowStatus.REQUESTED;
        newBorrow.borrowedAmount = (borrowAmount * RAY) / supportedCurrencies[fiatCurrency].borrowIndex;  /// 🔑 scaled
        newBorrow.totalRepaid = 0;

        // Add borrowId to user's borrow list
        userBorrows[msg.sender].push(borrowId);

        emit BorrowCreated(borrowId, msg.sender, fiatCurrency, borrowAmount);
    }

    function processBorrowRequest(uint256 borrowId) external onlyOwner hasBorrowRequested(borrowId) {
        Borrow storage borrowRecord = borrows[borrowId];
        borrowRecord.status = BorrowStatus.PROCESSED;
        emit BorrowProcessed(borrowId, borrowRecord.owner, borrowRecord.fiatCurrency);
    }

    function processBorrowRequests(uint256[] calldata borrowIds) external onlyOwner {
        require(borrowIds.length > 0, "Empty array");
        require(borrowIds.length <= 50, "Too many requests"); // Gas limit protection
        
        for (uint256 i = 0; i < borrowIds.length; i++) {
            uint256 borrowId = borrowIds[i];
            require(borrows[borrowId].owner != address(0), "Borrow not found");
            require(borrows[borrowId].status == BorrowStatus.REQUESTED, "Borrow not requested");
            
            Borrow storage borrowRecord = borrows[borrowId];
            borrowRecord.status = BorrowStatus.PROCESSED;
            emit BorrowProcessed(borrowId, borrowRecord.owner, borrowRecord.fiatCurrency);
        }
    }

    function cancelBorrowRequest(uint256 borrowId) external onlyOwner hasBorrowRequested(borrowId) {
        Borrow storage borrowRecord = borrows[borrowId];
        borrowRecord.status = BorrowStatus.CANCELED;
        emit BorrowCanceled(borrowId, borrowRecord.owner, borrowRecord.fiatCurrency);
    }

    function cancelBorrowRequests(uint256[] calldata borrowIds) external onlyOwner {
        require(borrowIds.length > 0, "Empty array");
        require(borrowIds.length <= 50, "Too many requests"); // Gas limit protection
        
        for (uint256 i = 0; i < borrowIds.length; i++) {
            uint256 borrowId = borrowIds[i];
            require(borrows[borrowId].owner != address(0), "Borrow not found");
            require(borrows[borrowId].status == BorrowStatus.REQUESTED, "Borrow not requested");
            
            Borrow storage borrowRecord = borrows[borrowId];
            borrowRecord.status = BorrowStatus.CANCELED;
            emit BorrowCanceled(borrowId, borrowRecord.owner, borrowRecord.fiatCurrency);
        }
    }

    // --- Repay ---
    function repayLoan(uint256 borrowId, uint256 repaymentAmount) external hasBorrowProcessed(borrowId) {
        Borrow storage loan = borrows[borrowId];
        require(loan.owner == msg.sender, "not your borrow");
        
        updateBorrowIndex(loan.fiatCurrency, loan.collateralAsset);  /// 🔑 sync

        uint256 totalOwed = (loan.borrowedAmount * supportedCurrencies[loan.fiatCurrency].borrowIndex) / RAY
            - loan.totalRepaid;

        require(repaymentAmount <= totalOwed, "exceeds owed");

        loan.totalRepaid += repaymentAmount;

        if (loan.totalRepaid >= totalOwed) {
            loan.status = BorrowStatus.REPAID;
            uint256 supplyId = uint256(keccak256(abi.encodePacked(msg.sender, loan.collateralAsset)));
            supplies[supplyId].status = SupplyStatus.ACTIVE;
        }

        uint256 remaining = totalOwed - repaymentAmount;
        emit LoanRepaid(borrowId, msg.sender, loan.fiatCurrency, repaymentAmount, remaining);
    }

    // --- Liquidation ---
    function liquidate(uint256 borrowId) external hasBorrowProcessed(borrowId) {
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
        emit CollateralLiquidated(borrowId, loan.owner, userSupply.scaledBalance);
    }

    // --- Health Factor Functions ---
    function _checkHealthFactor(address user, address asset, uint256 withdrawAmount) internal view returns (bool) {
        // Get user's total debt across all currencies
        uint256 totalDebtAsset = _getUserTotalDebtAsset(user);
        if (totalDebtAsset == 0) return true; // No debt, can withdraw freely

        // Get user's total collateral value after withdrawal
        uint256 totalCollateralAsset = _getUserTotalCollateralAsset(user, asset, withdrawAmount);
        
        // Calculate health factor: collateral / debt
        // Health factor should be >= 1.5 (150%) for safety
        uint256 healthFactor = (totalCollateralAsset * 1e18) / totalDebtAsset;
        return healthFactor >= 150e16; // 150% minimum health factor
    }

    function _getUserTotalDebtAsset(address user) internal view returns (uint256) {
        uint256[] memory userBorrowIds = userBorrows[user];
        uint256 totalDebtAsset = 0;

        for (uint256 i = 0; i < userBorrowIds.length; i++) {
            uint256 borrowId = userBorrowIds[i];
            Borrow storage userBorrow = borrows[borrowId];
            
            // Only count active borrows (PROCESSED status)
            if (userBorrow.status == BorrowStatus.PROCESSED) {
                // Calculate current debt with interest
                uint256 currentDebt = (userBorrow.borrowedAmount * supportedCurrencies[userBorrow.fiatCurrency].borrowIndex) / RAY;
                uint256 outstandingDebt = currentDebt - userBorrow.totalRepaid;
                
                // Convert debt to asset
                uint256 debtAsset = convertCurrencyToAsset(userBorrow.fiatCurrency, outstandingDebt, userBorrow.collateralAsset);
                totalDebtAsset += debtAsset;
            }
        }
        
        return totalDebtAsset;
    }

    function _getUserTotalCollateralAsset(address user, address asset, uint256 withdrawAmount) internal view returns (uint256) {
        uint256[] memory userSupplyIds = userSupplies[user];
        uint256 totalCollateralAsset = 0;

        for (uint256 i = 0; i < userSupplyIds.length; i++) {
            uint256 supplyId = userSupplyIds[i];
            Supply storage userSupply = supplies[supplyId];
            
            if (userSupply.status == SupplyStatus.ACTIVE) {
                uint256 currentIndex = aavePool.getReserveNormalizedIncome(userSupply.asset);
                uint256 supplyValue = (userSupply.scaledBalance * currentIndex) / RAY;
                
                // If this is the asset being withdrawn, subtract the withdraw amount
                if (userSupply.asset == asset) {
                    require(supplyValue >= withdrawAmount, "Insufficient supply balance");
                    supplyValue -= withdrawAmount;
                }
                
                totalCollateralAsset += supplyValue;
            }
        }
        
        return totalCollateralAsset;
    }

    function withdrawSupply(uint256 supplyId, uint256 withdrawAmount) external hasSupply(supplyId) {
        Supply storage userSupply = supplies[supplyId];
        require(userSupply.owner == msg.sender, "not your supply");
        require(userSupply.status == SupplyStatus.ACTIVE, "supply not active");

        // Check health factor before withdrawal
        require(_checkHealthFactor(msg.sender, userSupply.asset, withdrawAmount), "Insufficient health factor");

        uint256 currentIndex = aavePool.getReserveNormalizedIncome(userSupply.asset);
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
    console.log("price", price);
    require(price > 0, "Price cannot be zero");
    
    // Get currency and asset decimals
    uint8 currencyDecimals = fc.decimals;
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
    
    // Get currency and asset decimals
    uint8 currencyDecimals = fc.decimals;
    uint8 assetDecimals = supportedAssets[collateralAsset].decimals;
    
    // Convert: assetAmount (in assetDecimals) × price (in currencyDecimals) = result (in currencyDecimals)
    // Example: 795 (7.95 USD) × 1257 (12.57 BOB/USD) = 99.93 BOB = 9993 in raw
    // Formula: (assetAmount × price) ÷ 10^assetDecimals
    
    uint256 result = (assetAmount * price) / (10 ** assetDecimals);
    
    return result;
}

    // --- Public Health Factor Functions ---
    function getUserHealthFactor(address user) external view returns (uint256) {
        uint256 totalDebtAsset = _getUserTotalDebtAsset(user);
        if (totalDebtAsset == 0) return type(uint256).max; // No debt = infinite health factor
        
        uint256 totalCollateralAsset = _getUserTotalCollateralAsset(user, address(0), 0);
        return (totalCollateralAsset * 1e18) / totalDebtAsset;
    }

    function getUserTotalDebtAsset(address user) external view returns (uint256) {
        return _getUserTotalDebtAsset(user);
    }

    function getUserTotalCollateralAsset(address user) external view returns (uint256) {
        return _getUserTotalCollateralAsset(user, address(0), 0);
    }
}
