'use client';

import { useState, useCallback } from 'react';

interface NequiPaymentFormProps {
  onSubmit: (phoneNumber: string) => Promise<void>;
  isProcessing: boolean;
  amount: string;
  disabled?: boolean;
}

export default function NequiPaymentForm({
  onSubmit,
  isProcessing,
  amount,
  disabled = false,
}: NequiPaymentFormProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const validatePhone = useCallback((value: string): boolean => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setError('El número debe tener 10 dígitos');
      return false;
    }
    if (!cleaned.startsWith('3')) {
      setError('Ingresa un número de celular válido');
      return false;
    }
    setError('');
    return true;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (!validatePhone(cleaned)) return;
    await onSubmit(cleaned);
  };

  const handleChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(cleaned);
    if (touched) validatePhone(cleaned);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-kore-gray-dark/60">
          Recibirás una notificación en tu app Nequi para aprobar el pago.
        </p>
      </div>

      <div>
        <label htmlFor="nequiPhone" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
          Número de celular Nequi
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-kore-gray-dark/40 text-sm">
            +57
          </span>
          <input
            id="nequiPhone"
            type="tel"
            inputMode="numeric"
            value={phoneNumber}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => {
              setTouched(true);
              validatePhone(phoneNumber);
            }}
            placeholder="3001234567"
            disabled={disabled || isProcessing}
            className={`
              w-full pl-12 pr-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
              text-kore-gray-dark placeholder:text-kore-gray-dark/30
              focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
              disabled:opacity-50 disabled:cursor-not-allowed
              ${touched && error ? 'border-kore-red' : 'border-kore-gray-light/60'}
            `}
          />
        </div>
        {touched && error && (
          <p className="text-xs text-kore-red mt-1">{error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || isProcessing || !phoneNumber}
        className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
      >
        {isProcessing ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Esperando confirmación en Nequi...
          </span>
        ) : (
          `Pagar ${amount} con Nequi`
        )}
      </button>

      <p className="text-center text-xs text-kore-gray-dark/40 mt-2">
        Asegúrate de tener la app Nequi instalada y con saldo disponible.
      </p>
    </form>
  );
}
