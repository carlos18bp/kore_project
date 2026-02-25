'use client';

import Image from 'next/image';

export type PaymentMethod = 'card' | 'nequi' | 'pse' | 'bancolombia';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: string;
  isRecurring: boolean;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'card',
    name: 'Tarjeta',
    description: 'Crédito o débito',
    icon: '/images/payment-methods/card.svg',
    isRecurring: true,
  },
  {
    id: 'nequi',
    name: 'Nequi',
    description: 'Pago desde tu app',
    icon: '/images/payment-methods/Nequi.jpeg',
    isRecurring: false,
  },
  {
    id: 'pse',
    name: 'PSE',
    description: 'Débito bancario',
    icon: '/images/payment-methods/pse-seeklogo.png',
    isRecurring: false,
  },
  {
    id: 'bancolombia',
    name: 'Bancolombia',
    description: 'Transferencia',
    icon: '/images/payment-methods/Bancolombia.png',
    isRecurring: false,
  },
];

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onSelectMethod: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export default function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  disabled = false,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-kore-gray-dark mb-3">
        Elige tu método de pago
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {PAYMENT_METHODS.map((method) => {
          const isSelected = selectedMethod === method.id;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onSelectMethod(method.id)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'border-kore-red bg-kore-red/5'
                  : 'border-kore-gray-light/60 bg-white/40 hover:border-kore-red/40 hover:bg-white/60'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {method.isRecurring && (
                <span className="absolute -top-2 -right-2 bg-kore-red text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                  Auto
                </span>
              )}
              <div className="w-10 h-10 mb-2 relative flex items-center justify-center">
                <Image
                  src={method.icon}
                  alt={method.name}
                  width={40}
                  height={40}
                  className="object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <span className={`text-sm font-medium ${isSelected ? 'text-kore-red' : 'text-kore-gray-dark'}`}>
                {method.name}
              </span>
              <span className="text-xs text-kore-gray-dark/50 mt-0.5">
                {method.description}
              </span>
            </button>
          );
        })}
      </div>
      {selectedMethod && (
        <p className="text-xs text-kore-gray-dark/50 text-center mt-2">
          {PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.isRecurring
            ? '✓ Renovación automática cada mes'
            : 'Renovación manual - deberás pagar cada mes'}
        </p>
      )}
    </div>
  );
}
