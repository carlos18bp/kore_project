'use client';

import { useState } from 'react';
import { api } from '@/lib/services/http';

type Step = 'code' | 'password';

interface PasswordResetModalProps {
  email: string;
  onClose: () => void;
}

export default function PasswordResetModal({ email, onClose }: PasswordResetModalProps) {
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { data } = await api.post<{ reset_token: string }>(
        '/auth/password-reset/verify-code/',
        { email, code },
      );
      setResetToken(data.reset_token);
      setStep('password');
    } catch {
      setError('Código inválido o expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/auth/password-reset/reset/', {
        reset_token: resetToken,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      setSuccess('¡Contraseña actualizada correctamente!');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      const axiosErr = err as { response?: { data?: { detail?: string | string[] } } };
      const detail = axiosErr.response?.data?.detail;
      if (Array.isArray(detail)) setError(detail.join(' '));
      else if (typeof detail === 'string') setError(detail);
      else setError('Error al cambiar la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsLoading(true);
    try {
      await api.post('/auth/password-reset/request-code/', { email });
      setSuccess('Código reenviado. Revisa tu correo.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Error al reenviar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 md:p-8 border border-kore-gray-light/30">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-kore-gray-dark/30 hover:text-kore-gray-dark/60 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['code', 'password'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s
                  ? 'bg-kore-red text-white'
                  : (['code', 'password'].indexOf(step) > i)
                    ? 'bg-kore-red/20 text-kore-red'
                    : 'bg-kore-gray-light/60 text-kore-gray-dark/40'
              }`}>
                {i + 1}
              </div>
              {i < 1 && (
                <div className={`w-6 h-0.5 ${(['code', 'password'].indexOf(step) > i) ? 'bg-kore-red/30' : 'bg-kore-gray-light/60'}`} />
              )}
            </div>
          ))}
        </div>

        <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-1 text-center">
          {step === 'code' ? 'Ingresa el código' : 'Nueva contraseña'}
        </h2>
        <p className="text-xs text-kore-gray-dark/50 text-center mb-5">
          {step === 'code'
            ? 'Revisa tu correo e ingresa el código de 6 dígitos.'
            : 'Elige tu nueva contraseña.'}
        </p>

        {/* Error / Success */}
        {error && (
          <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-2.5 mb-4">
            <p className="text-sm text-kore-red">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-4">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Step 1: Code */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2">
                Código de verificación
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 bg-kore-cream/30 text-kore-gray-dark text-sm focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <p className="text-xs text-kore-gray-dark/40 text-center">
              Enviado a <strong className="text-kore-gray-dark/60">{email}</strong>
            </p>
            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3 rounded-xl transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Verificando...' : 'Verificar código'}
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isLoading}
              className="w-full text-sm text-kore-gray-dark/50 hover:text-kore-red transition-colors disabled:opacity-50"
            >
              Reenviar código
            </button>
          </form>
        )}

        {/* Step 2: New Password */}
        {step === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 bg-kore-cream/30 text-kore-gray-dark text-sm focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-kore-gray-dark/30 hover:text-kore-gray-dark/60 transition-colors text-xs"
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2">
                Confirmar contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 bg-kore-cream/30 text-kore-gray-dark text-sm focus:outline-none focus:ring-2 focus:ring-kore-red/30 focus:border-kore-red/30 transition"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !newPassword || !confirmPassword}
              className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3 rounded-xl transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
