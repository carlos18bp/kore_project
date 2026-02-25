'use client';

import { useState } from 'react';

interface BancolombiaPaymentFormProps {
  onSubmit: () => Promise<void>;
  isProcessing: boolean;
  amount: string;
  packageTitle: string;
  disabled?: boolean;
}

export default function BancolombiaPaymentForm({
  onSubmit,
  isProcessing,
  amount,
  packageTitle,
  disabled = false,
}: BancolombiaPaymentFormProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-kore-gray-dark/60">
          Serás redirigido a Bancolombia para completar el pago.
        </p>
      </div>

      <div className="bg-kore-cream/50 rounded-lg p-4 border border-kore-gray-light/40">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-kore-gray-dark/60">Concepto</span>
          <span className="font-medium text-kore-gray-dark">{packageTitle}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-kore-gray-dark/60">Monto a pagar</span>
          <span className="font-semibold text-kore-red">{amount}</span>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={disabled || isProcessing}
          className="mt-0.5 h-4 w-4 rounded border-kore-gray-light text-kore-red focus:ring-kore-red/20 cursor-pointer"
        />
        <span className="text-xs text-kore-gray-dark/60">
          Confirmo que tengo una cuenta Bancolombia y deseo continuar con este método de pago.
        </span>
      </label>

      <button
        type="submit"
        disabled={disabled || isProcessing || !confirmed}
        className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
      >
        {isProcessing ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Redirigiendo a Bancolombia...
          </span>
        ) : (
          `Pagar ${amount} con Bancolombia`
        )}
      </button>

      <p className="text-center text-xs text-kore-gray-dark/40 mt-2">
        Necesitas tener una cuenta de ahorros o corriente en Bancolombia.
      </p>
    </form>
  );
}
