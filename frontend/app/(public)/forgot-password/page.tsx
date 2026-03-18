'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { api } from '@/lib/services/http';

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();

  useHeroAnimation(sectionRef);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await api.post('/auth/password-reset/request-code/', { email });
      setStep('code');
      setSuccess('Si el correo existe, recibirás un código de 6 dígitos.');
    } catch {
      setError('Error al enviar el código. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      const { data } = await api.post<{ reset_token: string }>(
        '/auth/password-reset/verify-code/',
        { email, code },
      );
      setResetToken(data.reset_token);
      setStep('password');
    } catch {
      setError('Código inválido o expirado. Verifica e intenta de nuevo.');
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
      setSuccess('¡Contraseña actualizada! Redirigiendo al login...');
      setTimeout(() => router.push('/login'), 2000);
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

  const stepTitles: Record<Step, string> = {
    email: 'Recuperar contraseña',
    code: 'Ingresa el código',
    password: 'Nueva contraseña',
  };

  const stepDescriptions: Record<Step, string> = {
    email: 'Ingresa tu correo y te enviaremos un código de verificación.',
    code: 'Revisa tu correo e ingresa el código de 6 dígitos.',
    password: 'Elige tu nueva contraseña.',
  };

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream flex items-center justify-center relative overflow-hidden">
      {/* Background flower decoration */}
      <div className="absolute -right-40 -bottom-40 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-[0.04] pointer-events-none select-none">
        <Image src="/images/flower.webp" alt="" fill sizes="(max-width: 1024px) 600px, 800px" className="object-contain" aria-hidden="true" />
      </div>

      <div className="w-full max-w-md mx-auto px-6 pt-24 pb-16 md:py-16">
        {/* Logo */}
        <div data-hero="badge" className="text-center mb-10">
          <Link href="/">
            <span className="font-heading text-5xl font-semibold text-kore-gray-dark tracking-tight">KÓRE</span>
          </Link>
          <p data-hero="subtitle" className="text-kore-gray-dark/50 text-sm mt-2 tracking-wide">
            {stepDescriptions[step]}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['email', 'code', 'password'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s
                  ? 'bg-kore-red text-white'
                  : (['email', 'code', 'password'].indexOf(step) > i)
                    ? 'bg-kore-red/20 text-kore-red'
                    : 'bg-kore-gray-light/60 text-kore-gray-dark/40'
              }`}>
                {i + 1}
              </div>
              {i < 2 && (
                <div className={`w-8 h-0.5 ${(['email', 'code', 'password'].indexOf(step) > i) ? 'bg-kore-red/30' : 'bg-kore-gray-light/60'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div data-hero="body" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-kore-gray-light/50">
          <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-6">{stepTitles[step]}</h2>

          {/* Error / Success */}
          {error && (
            <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-kore-red">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2">
                  Correo electrónico
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enviando...
                  </span>
                ) : 'Enviar código'}
              </button>
            </form>
          )}

          {/* Step 2: Code */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <label htmlFor="reset-code" className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2">
                  Código de verificación
                </label>
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
              <p className="text-xs text-kore-gray-dark/40 text-center">
                El código se envió a <strong className="text-kore-gray-dark/60">{email}</strong>
              </p>
              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verificando...
                  </span>
                ) : 'Verificar código'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); setSuccess(''); }}
                className="w-full text-sm text-kore-gray-dark/50 hover:text-kore-red transition-colors"
              >
                Volver a enviar código
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-kore-gray-dark/30 hover:text-kore-gray-dark/60 transition-colors text-sm"
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2">
                  Confirmar contraseña
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  required
                  minLength={8}
                  className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Guardando...
                  </span>
                ) : 'Cambiar contraseña'}
              </button>
            </form>
          )}
        </div>

        {/* Back to login */}
        <p data-hero="cta" className="text-center text-xs text-kore-gray-dark/30 mt-8">
          <Link href="/login" className="text-kore-red hover:text-kore-red-dark transition-colors">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </section>
  );
}
