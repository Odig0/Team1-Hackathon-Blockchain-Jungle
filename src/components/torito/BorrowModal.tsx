"use client";

import { useEffect, useState } from "react";
import { useChainId } from "wagmi";
import { ArrowUpTrayIcon, BanknotesIcon, BuildingLibraryIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { COUNTRIES, DEFAULT_COUNTRY_ID } from "../../constants/countries";
import { useBorrow } from "../../hooks/torito/useBorrow";
import { useSupplyBalance } from "../../hooks/torito/useSupplyBalance";
import { getUSDCAddress } from "../../utils/networkConfig";

type DestType = "bank" | "qr";

const BOLIVIAN_BANKS = [
  "Mercantile Bank Santa Cruz",
  "Cattle Bank",
  "National Bank of Bolivia",
  "Bisa Bank",
  "Sol Bank",
  "Union Bank",
  "Economic Bank",
  "Fassil Bank",
  "Fortress Bank",
  "FIE Bank",
  "SME Bank",
  "Credit Bank of Bolivia",
] as const;

export const BorrowModal = () => {
  return <BorrowModalInner />;
};

const BorrowModalInner = () => {
  const [loanOpen, setLoanOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const [amountBs, setAmountBs] = useState<string>("");
  const [destType, setDestType] = useState<DestType>("bank");

  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrText, setQrText] = useState("");

  // Hooks para blockchain
  const chainId = useChainId();
  const { borrow, isBorrowing, isConfirmed, error: borrowError } = useBorrow();
  const usdcAddress = getUSDCAddress(chainId);

  // Obtener el balance del usuario de Torito
  const { formattedShares, isLoading: isLoadingBalance } = useSupplyBalance();

  // Obtener información del país para el cálculo
  const country = COUNTRIES.find(c => c.id === DEFAULT_COUNTRY_ID)!;

  // Calcular el préstamo máximo basado en el saldo de Torito
  const usdtBalance = parseFloat(formattedShares || "0");
  const localBalance = usdtBalance * country.rate;
  // Para pruebas, permitir hasta 10000 Bs aunque no haya depósitos
  const maxLoanAmount = usdtBalance > 0 ? localBalance * 0.5 : 10000;

  const available = maxLoanAmount;
  const amountNum = Number(amountBs || 0);

  const canSubmit =
    amountNum > 0 &&
    amountNum <= maxLoanAmount &&
    (destType === "bank"
      ? bankName.trim().length > 0 && bankAccount.trim().length > 0
      : qrFile !== null || qrText.trim().length > 0);

  const fmt = (n: number) => new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 }).format(n);

  useEffect(() => {
    if (isConfirmed) {
      setLoading(false);
      openResultAndReset();
      setAmountBs("");
      setBankName("");
      setBankAccount("");
      setQrFile(null);
      setQrText("");
    }
  }, [isConfirmed]);

  useEffect(() => {
    if (borrowError) {
      setLoading(false);
    }
  }, [borrowError]);

  const openResultAndReset = () => {
    setLoanOpen(false);
    setPaymentProcessing(true);
    setPaymentCompleted(false);
    setTimeout(() => {
      setResultOpen(true);
      // Simular proceso de pago - después de 3 segundos marcar como completado
      setTimeout(() => {
        setPaymentProcessing(false);
        setPaymentCompleted(true);
      }, 3000);
    }, 150);
  };

  const solicitarPrestamo = async () => {
    if (!canSubmit || isBorrowing || loading) return;

    try {
      setLoading(true);
      const amountFiat = parseFloat(amountBs);

      console.log("=== INICIANDO BORROW ===");
      console.log("Token colateral (USDC):", usdcAddress);
      console.log("Monto en Bs:", amountFiat);
      console.log("Currency code:", country.code);
      console.log("Saldo en Torito:", formattedShares);

      await borrow(usdcAddress, amountFiat.toString(), country.code);
      console.log("✅ Borrow completado exitosamente");
      // No resetear loading aquí, se hará en el useEffect cuando isConfirmed sea true
    } catch (e) {
      setLoading(false);
      console.error("❌ Error requesting loan:", e);
      // Mostrar el error al usuario
      alert(`Error al solicitar préstamo: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onChangeAmount = (v: string) => {
    let clean = v.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }

    if (clean === "" || clean === ".") {
      setAmountBs(clean);
      return;
    }

    const n = Number(clean);
    if (n >= maxLoanAmount) {
      setAmountBs(String(maxLoanAmount));
    } else {
      setAmountBs(clean);
    }
  };

  return (
    <>
      <button
        onClick={() => setLoanOpen(true)}
        className="group relative bg-blue-500 hover:bg-blue-600 active:bg-blue-800 text-white px-6 py-2 rounded-2xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 min-w-[140px] justify-center"
      >
        <BanknotesIcon className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
        <span className="text-base">Borrow</span>
      </button>

      {/* Modal de préstamo */}
      {loanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 relative">
              <button
                onClick={() => setLoanOpen(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold m-0">Loan</h3>
              </div>

              <p className="text-gray-600 mb-4">
                {isLoadingBalance ? (
                  "Loading your balance..."
                ) : usdtBalance > 0 ? (
                  <>
                    You can borrow up to{" "}
                    <strong>
                      {fmt(maxLoanAmount)} {country.symbol}
                    </strong>{" "}
                    with your current balance.
                  </>
                ) : (
                  <>
                    You can request up to{" "}
                    <strong>
                      {fmt(maxLoanAmount)} {country.symbol}
                    </strong>{" "}
                    (test mode).
                  </>
                )}
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">How much do you want to borrow?</label>
                <div className="relative group">
                  <input
                    inputMode="decimal"
                    value={amountBs}
                    onChange={e => onChangeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-4 pr-20 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 focus:bg-blue-50 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-600 font-medium group-focus-within:text-blue-600 transition-colors">
                    {country.symbol}
                  </div>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {isLoadingBalance ? (
                    "Loading..."
                  ) : (
                    <>
                      Available:{" "}
                      <strong className="text-blue-600">
                        {fmt(available)} {country.symbol}
                      </strong>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Where do you want to receive the money?
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setDestType("bank")}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all duration-200 transform ${
                      destType === "bank"
                        ? "border-blue-500 bg-blue-50 shadow-md scale-105"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm"
                    }`}
                  >
                    <BuildingLibraryIcon className={`h-5 w-5 ${destType === "bank" ? "text-blue-600" : "text-gray-600"}`} />
                    <div className="leading-tight">
                      <div className={`font-medium text-sm ${destType === "bank" ? "text-blue-900" : "text-gray-900"}`}>Bank account</div>
                      <div className="text-xs text-gray-500">Deposit to your local account</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestType("qr")}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all duration-200 transform ${
                      destType === "qr"
                        ? "border-blue-500 bg-blue-50 shadow-md scale-105"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm"
                    }`}
                  >
                    <QrCodeIcon className={`h-5 w-5 ${destType === "qr" ? "text-blue-600" : "text-gray-600"}`} />
                    <div className="leading-tight">
                      <div className={`font-medium text-sm ${destType === "qr" ? "text-blue-900" : "text-gray-900"}`}>Import QR</div>
                      <div className="text-xs text-gray-500">Send to an account by QR</div>
                    </div>
                  </button>
                </div>

                {destType === "bank" ? (
                  <div className="space-y-3">
                    <select
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 focus:bg-blue-50 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <option value="">Select your bank</option>
                      {BOLIVIAN_BANKS.map(bank => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                    <input
                      value={bankAccount}
                      onChange={e => setBankAccount(e.target.value.replace(/[^\d\-]/g, ""))}
                      placeholder="Account number"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 focus:bg-blue-50 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md">
                      <span className="flex items-center gap-2 text-gray-700 text-sm">
                        <ArrowUpTrayIcon className="h-5 w-5" />
                        {qrFile ? (
                          <span className="truncate max-w-[220px]">{qrFile.name}</span>
                        ) : (
                          <span>Upload QR image (PNG/JPG)</span>
                        )}
                      </span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg"
                        className="hidden"
                        onChange={e => setQrFile(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    <textarea
                      value={qrText}
                      onChange={e => setQrText(e.target.value)}
                      placeholder="Paste QR data here (optional)"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 focus:bg-blue-50 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-sm shadow-sm hover:shadow-md"
                    />
                    <p className="text-xs text-gray-500">
                      You can upload the QR or paste its data. Either one is sufficient.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <button
                  onClick={solicitarPrestamo}
                  disabled={!canSubmit || loading || isBorrowing}
                  className={`w-full px-8 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                    canSubmit && !loading && !isBorrowing
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {loading || isBorrowing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <BanknotesIcon className="h-5 w-5" />
                      <span>Request loan</span>
                    </>
                  )}
                </button>
                {!canSubmit && (
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    Enter a valid amount and destination to continue.
                  </p>
                )}
                {borrowError && <p className="mt-2 text-xs text-red-500 text-center">Error: {borrowError.message}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de resultado */}
      {resultOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 relative">
              {!paymentProcessing && (
                <button
                  onClick={() => {
                    setResultOpen(false);
                    setPaymentCompleted(false);
                  }}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  ✕
                </button>
              )}

              <div className="space-y-4">
                {paymentProcessing ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-700"></div>
                      </div>
                      <h3 className="text-xl font-bold m-0">Processing payment...</h3>
                    </div>

                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                      <p className="text-gray-700 text-sm">
                        Estamos enviando {amountBs} {country.symbol} a tu {destType === "bank" ? "cuenta bancaria" : "QR"}...
                      </p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Verifying data</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Processing transfer</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                          <span>Confirming with bank...</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-500 text-sm text-center">
                      Please wait, this may take a few seconds...
                    </p>
                  </>
                ) : paymentCompleted ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold m-0 text-green-700">Payment successful!</h3>
                    </div>

                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                      <p className="text-gray-700 font-medium mb-2">
                        {amountBs} {country.symbol} have been sent
                      </p>
                      <div className="space-y-1 text-sm text-gray-600">
                        {destType === "bank" ? (
                          <>
                            <p>
                              <strong>Banco:</strong> {bankName}
                            </p>
                            <p>
                              <strong>Cuenta:</strong> {bankAccount}
                            </p>
                          </>
                        ) : (
                          <p>
                            <strong>Destino:</strong> Cuenta QR
                          </p>
                        )}
                        <p className="mt-2 text-xs text-gray-500">
                          The money will be available in your account in the next few minutes.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setResultOpen(false);
                        setPaymentCompleted(false);
                      }}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-200"
                    >
                                          Close
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
