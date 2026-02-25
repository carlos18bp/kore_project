'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PSEPaymentData {
  financial_institution_code: string;
  user_type: number;
  user_legal_id_type: string;
  user_legal_id: string;
  full_name: string;
  phone_number: string;
}

interface FinancialInstitution {
  financial_institution_code: string;
  financial_institution_name: string;
}

interface PSEPaymentFormProps {
  onSubmit: (data: PSEPaymentData) => Promise<void>;
  onFetchBanks: () => Promise<FinancialInstitution[]>;
  isProcessing: boolean;
  amount: string;
  disabled?: boolean;
  userEmail?: string;
}

const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PP', label: 'Pasaporte' },
];

const USER_TYPES = [
  { value: 0, label: 'Persona Natural' },
  { value: 1, label: 'Persona Jurídica' },
];

export default function PSEPaymentForm({
  onSubmit,
  onFetchBanks,
  isProcessing,
  amount,
  disabled = false,
}: PSEPaymentFormProps) {
  const [banks, setBanks] = useState<FinancialInstitution[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [bankError, setBankError] = useState('');

  const [bankCode, setBankCode] = useState('');
  const [userType, setUserType] = useState<number>(0);
  const [docType, setDocType] = useState('CC');
  const [docNumber, setDocNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadBanks = async () => {
      try {
        const data = await onFetchBanks();
        setBanks(data);
        setBankError('');
      } catch {
        setBankError('No se pudieron cargar los bancos. Intenta de nuevo.');
      } finally {
        setLoadingBanks(false);
      }
    };
    loadBanks();
  }, [onFetchBanks]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!bankCode) newErrors.bank = 'Selecciona un banco';
    if (!docNumber || docNumber.length < 5) newErrors.docNumber = 'Documento inválido';
    if (!fullName || fullName.trim().length < 3) newErrors.fullName = 'Nombre requerido';
    
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) newErrors.phone = 'Teléfono inválido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [bankCode, docNumber, fullName, phoneNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const data: PSEPaymentData = {
      financial_institution_code: bankCode,
      user_type: userType,
      user_legal_id_type: docType,
      user_legal_id: docNumber.replace(/\D/g, ''),
      full_name: fullName.trim(),
      phone_number: '57' + phoneNumber.replace(/\D/g, ''),
    };

    await onSubmit(data);
  };

  if (loadingBanks) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-6 w-6 text-kore-red" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-2 text-sm text-kore-gray-dark/60">Cargando bancos...</span>
      </div>
    );
  }

  if (bankError) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-kore-red mb-2">{bankError}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-kore-red text-sm hover:text-kore-red-dark transition-colors cursor-pointer"
        >
          Recargar página
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-kore-gray-dark/60">
          Serás redirigido a tu banco para completar el pago.
        </p>
      </div>

      {/* Bank selector */}
      <div>
        <label htmlFor="bank" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
          Banco
        </label>
        <select
          id="bank"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          disabled={disabled || isProcessing}
          className={`
            w-full px-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
            text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
            ${errors.bank ? 'border-kore-red' : 'border-kore-gray-light/60'}
          `}
        >
          <option value="">Selecciona tu banco</option>
          {banks.map((bank) => (
            <option key={bank.financial_institution_code} value={bank.financial_institution_code}>
              {bank.financial_institution_name}
            </option>
          ))}
        </select>
        {errors.bank && <p className="text-xs text-kore-red mt-1">{errors.bank}</p>}
      </div>

      {/* User type */}
      <div>
        <label className="block text-sm font-medium text-kore-gray-dark mb-1.5">
          Tipo de persona
        </label>
        <div className="grid grid-cols-2 gap-2">
          {USER_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setUserType(type.value)}
              disabled={disabled || isProcessing}
              className={`
                px-3 py-2 rounded-lg border text-sm transition-colors cursor-pointer
                ${userType === type.value
                  ? 'border-kore-red bg-kore-red/5 text-kore-red'
                  : 'border-kore-gray-light/60 bg-white/40 text-kore-gray-dark hover:border-kore-red/40'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="docType" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
            Tipo
          </label>
          <select
            id="docType"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            disabled={disabled || isProcessing}
            className="w-full px-3 py-3 rounded-lg border border-kore-gray-light/60 bg-white/60 text-kore-gray-dark text-sm focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red disabled:opacity-50 cursor-pointer"
          >
            {DOCUMENT_TYPES.map((doc) => (
              <option key={doc.value} value={doc.value}>{doc.value}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="docNumber" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
            Número de documento
          </label>
          <input
            id="docNumber"
            type="text"
            inputMode="numeric"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="1234567890"
            disabled={disabled || isProcessing}
            className={`
              w-full px-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
              text-kore-gray-dark placeholder:text-kore-gray-dark/30
              focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
              disabled:opacity-50 disabled:cursor-not-allowed
              ${errors.docNumber ? 'border-kore-red' : 'border-kore-gray-light/60'}
            `}
          />
          {errors.docNumber && <p className="text-xs text-kore-red mt-1">{errors.docNumber}</p>}
        </div>
      </div>

      {/* Full name */}
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
          Nombre completo
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Juan Pérez"
          disabled={disabled || isProcessing}
          className={`
            w-full px-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
            text-kore-gray-dark placeholder:text-kore-gray-dark/30
            focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
            disabled:opacity-50 disabled:cursor-not-allowed
            ${errors.fullName ? 'border-kore-red' : 'border-kore-gray-light/60'}
          `}
        />
        {errors.fullName && <p className="text-xs text-kore-red mt-1">{errors.fullName}</p>}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-kore-gray-dark mb-1.5">
          Teléfono
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-kore-gray-dark/40 text-sm">
            +57
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="3001234567"
            disabled={disabled || isProcessing}
            className={`
              w-full pl-12 pr-4 py-3 rounded-lg border bg-white/60 backdrop-blur-sm
              text-kore-gray-dark placeholder:text-kore-gray-dark/30
              focus:outline-none focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red
              disabled:opacity-50 disabled:cursor-not-allowed
              ${errors.phone ? 'border-kore-red' : 'border-kore-gray-light/60'}
            `}
          />
        </div>
        {errors.phone && <p className="text-xs text-kore-red mt-1">{errors.phone}</p>}
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
            Procesando...
          </span>
        ) : (
          `Pagar ${amount} con PSE`
        )}
      </button>
    </form>
  );
}
