'use client';

import { useState, useCallback } from 'react';

interface CardPaymentFormProps {
  onSubmit: (cardData: CardData) => Promise<void>;
  isProcessing: boolean;
  amount: string;
  disabled?: boolean;
}

export interface CardData {
  number: string;
  cvc: string;
  exp_month: string;
  exp_year: string;
  card_holder: string;
}

interface FormErrors {
  number?: string;
  cvc?: string;
  expiry?: string;
  card_holder?: string;
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  const groups = digits.match(/.{1,4}/g);
  return groups ? groups.join(' ') : '';
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

function getCardBrand(number: string): string {
  const cleaned = number.replace(/\s/g, '');
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  return '';
}

export default function CardPaymentForm({
  onSubmit,
  isProcessing,
  amount,
  disabled = false,
}: CardPaymentFormProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const cardBrand = getCardBrand(cardNumber);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    const cleanNumber = cardNumber.replace(/\s/g, '');

    if (!cleanNumber || cleanNumber.length < 13 || cleanNumber.length > 19) {
      newErrors.number = 'Número de tarjeta inválido';
    }

    const [month, year] = expiry.split('/');
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;

    if (!month || !year || monthNum < 1 || monthNum > 12) {
      newErrors.expiry = 'Fecha inválida';
    } else if (yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth)) {
      newErrors.expiry = 'Tarjeta vencida';
    }

    if (!cvc || cvc.length < 3 || cvc.length > 4) {
      newErrors.cvc = 'CVV inválido';
    }

    if (!cardHolder.trim() || cardHolder.trim().length < 5) {
      newErrors.card_holder = 'Nombre debe tener al menos 5 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [cardNumber, expiry, cvc, cardHolder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const [month, year] = expiry.split('/');
    const cardData: CardData = {
      number: cardNumber.replace(/\s/g, ''),
      cvc,
      exp_month: month.padStart(2, '0'),
      exp_year: year,
      card_holder: cardHolder.trim().toUpperCase(),
    };

    await onSubmit(cardData);
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cardNumber" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
          Número de tarjeta
        </label>
        <div className="relative">
          <input
            id="cardNumber"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            onBlur={() => handleBlur('number')}
            placeholder="1234 5678 9012 3456"
            disabled={disabled || isProcessing}
            className={`
              w-full px-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
              text-kore-gray-dark placeholder:text-kore-gray-dark/30
              focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
              disabled:opacity-50 disabled:cursor-not-allowed
              ${touched.number && errors.number ? 'border-kore-red' : 'border-kore-gray-light/60'}
            `}
          />
          {cardBrand && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-kore-gray-dark/50 uppercase">
              {cardBrand}
            </span>
          )}
        </div>
        {touched.number && errors.number && (
          <p className="text-xs text-kore-red mt-1">{errors.number}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="expiry" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
            Vencimiento
          </label>
          <input
            id="expiry"
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            onBlur={() => handleBlur('expiry')}
            placeholder="MM/AA"
            disabled={disabled || isProcessing}
            className={`
              w-full px-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
              text-kore-gray-dark placeholder:text-kore-gray-dark/30
              focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
              disabled:opacity-50 disabled:cursor-not-allowed
              ${touched.expiry && errors.expiry ? 'border-kore-red' : 'border-kore-gray-light/60'}
            `}
          />
          {touched.expiry && errors.expiry && (
            <p className="text-xs text-kore-red mt-1">{errors.expiry}</p>
          )}
        </div>

        <div>
          <label htmlFor="cvc" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
            CVV
          </label>
          <input
            id="cvc"
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={() => handleBlur('cvc')}
            placeholder="123"
            disabled={disabled || isProcessing}
            className={`
              w-full px-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
              text-kore-gray-dark placeholder:text-kore-gray-dark/30
              focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
              disabled:opacity-50 disabled:cursor-not-allowed
              ${touched.cvc && errors.cvc ? 'border-kore-red' : 'border-kore-gray-light/60'}
            `}
          />
          {touched.cvc && errors.cvc && (
            <p className="text-xs text-kore-red mt-1">{errors.cvc}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="cardHolder" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
          Nombre en la tarjeta
        </label>
        <input
          id="cardHolder"
          type="text"
          autoComplete="cc-name"
          value={cardHolder}
          onChange={(e) => setCardHolder(e.target.value)}
          onBlur={() => handleBlur('card_holder')}
          placeholder="JUAN PÉREZ"
          disabled={disabled || isProcessing}
          className={`
            w-full px-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
            text-kore-gray-dark placeholder:text-kore-gray-dark/30 uppercase
            focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
            disabled:opacity-50 disabled:cursor-not-allowed
            ${touched.card_holder && errors.card_holder ? 'border-kore-red' : 'border-kore-gray-light/60'}
          `}
        />
        {touched.card_holder && errors.card_holder && (
          <p className="text-xs text-kore-red mt-1">{errors.card_holder}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || isProcessing}
        className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
      >
        {isProcessing ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Procesando pago...
          </span>
        ) : (
          `Pagar ${amount}`
        )}
      </button>

      <p className="text-center text-xs text-kore-gray-dark/40 mt-2">
        Tu tarjeta será guardada para renovaciones automáticas
      </p>
    </form>
  );
}
