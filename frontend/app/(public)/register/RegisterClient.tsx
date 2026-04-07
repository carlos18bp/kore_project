'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReCAPTCHA from 'react-google-recaptcha';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { useAuthStore } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';

const CHECKOUT_REGISTRATION_TOKEN_KEY = 'kore_checkout_registration_token';
const CHECKOUT_REGISTRATION_PACKAGE_KEY = 'kore_checkout_registration_package';
const CODE_EXPIRY_SECONDS = 10 * 60;

type Step = 'form' | 'verify';

export default function RegisterClient() {
  const [step, setStep] = useState<Step>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState<string>('');
  const [preRegistrationToken, setPreRegistrationToken] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const redirectTimeoutRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, hydrate, hydrated } = useAuthStore();

  const packageId = searchParams.get('package');

  useHeroAnimation(sectionRef);

  const startCountdown = useCallback(() => {
    setCountdown(CODE_EXPIRY_SECONDS);
    if (countdownRef.current !== null) window.clearInterval(countdownRef.current);
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current !== null) window.clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      if (packageId) {
        router.push(`/checkout?package=${packageId}`);
      } else {
        router.push('/dashboard');
      }
    }
  }, [hydrated, isAuthenticated, router, packageId]);

  useEffect(() => {
    api.get('/google-captcha/site-key/')
      .then((res) => setSiteKey(res.data.site_key))
      .catch(() => {});

    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
      if (countdownRef.current !== null) {
        window.clearInterval(countdownRef.current);
      }
    };
  }, []);

  const extractErrorMessage = (responseData: unknown): string => {
    if (!responseData || typeof responseData !== 'object') {
      return 'No se pudo validar el registro. Intenta de nuevo.';
    }

    const entries = Object.values(responseData as Record<string, unknown>);
    if (entries.length === 0) {
      return 'No se pudo validar el registro. Intenta de nuevo.';
    }

    const firstError = entries[0];
    if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
      return firstError[0];
    }
    if (typeof firstError === 'string') {
      return firstError;
    }

    return 'No se pudo validar el registro. Intenta de nuevo.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (siteKey && !captchaToken) {
      setError('Por favor completa el captcha');
      return;
    }

    if (!packageId) {
      setError('Selecciona un programa antes de continuar al pago.');
      setIsLoading(false);
      router.push('/programs');
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await api.post<{
        verification_pending: boolean;
        pre_registration_token: string;
      }>('/auth/pre-register/', {
        email,
        password,
        password_confirm: passwordConfirm,
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        captcha_token: captchaToken,
      });

      setPreRegistrationToken(data.pre_registration_token);
      setStep('verify');
      startCountdown();
    } catch (err) {
      const axiosErr = err as { response?: { data?: unknown; status?: number } };
      if (axiosErr.response?.status === 429) {
        setError('Has solicitado demasiados códigos. Intenta de nuevo más tarde.');
      } else {
        const message = extractErrorMessage(axiosErr.response?.data);
        if (/ya existe una cuenta|already exists|already registered/i.test(message)) {
          setError('Ya existe una cuenta con este correo. Redirigiendo a iniciar sesión...');
          redirectTimeoutRef.current = window.setTimeout(() => {
            router.push('/login');
          }, 1000);
        } else {
          setError(message);
        }
      }
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
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
      const { data } = await api.post<{ registration_token: string }>(
        '/auth/verify-registration/',
        { pre_registration_token: preRegistrationToken, code },
      );

      if (typeof window !== 'undefined' && packageId) {
        sessionStorage.setItem(CHECKOUT_REGISTRATION_TOKEN_KEY, data.registration_token);
        sessionStorage.setItem(CHECKOUT_REGISTRATION_PACKAGE_KEY, packageId);
      }

      router.push(`/checkout?package=${packageId}`);
    } catch {
      setError('Código inválido o expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await api.post('/auth/resend-verification-code/', {
        pre_registration_token: preRegistrationToken,
      });
      setCode('');
      startCountdown();
      setSuccess('Código reenviado. Revisa tu correo.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 429) {
        setError('Has solicitado demasiados códigos. Intenta de nuevo más tarde.');
      } else {
        setError('Error al reenviar el código.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!hydrated) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream flex items-center justify-center relative overflow-hidden">
      {/* Background flower decoration */}
      <div className="absolute -right-40 -bottom-40 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-[0.04] pointer-events-none select-none">
        <Image
          src="/images/flower.webp"
          alt=""
          fill
          sizes="(max-width: 1024px) 600px, 800px"
          className="object-contain"
          aria-hidden="true"
        />
      </div>

      <div className="w-full max-w-md mx-auto px-6 pt-24 pb-16 md:py-16">
        {/* Logo / Brand */}
        <div data-hero="badge" className="text-center mb-10">
          <Link href="/">
            <span className="font-heading text-5xl font-semibold text-kore-gray-dark tracking-tight">
              KÓRE
            </span>
          </Link>
          <p data-hero="subtitle" className="text-kore-gray-dark/50 text-sm mt-2 tracking-wide">
            {step === 'form' ? 'Crea tu cuenta' : 'Verifica tu correo'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['form', 'verify'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step === s
                  ? 'bg-kore-red text-white'
                  : (['form', 'verify'].indexOf(step) > i)
                    ? 'bg-kore-red/20 text-kore-red'
                    : 'bg-kore-gray-light/60 text-kore-gray-dark/40'
              }`}>
                {i + 1}
              </div>
              {i < 1 && (
                <div className={`w-8 h-0.5 ${(['form', 'verify'].indexOf(step) > i) ? 'bg-kore-red/30' : 'bg-kore-gray-light/60'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div data-hero="body" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-kore-gray-light/50">
          {/* Error / Success messages */}
          {error && (
            <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-kore-red">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-5">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Step 1: Registration Form */}
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name fields row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2"
                  >
                    Nombre
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2"
                  >
                    Apellido
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Tu apellido"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors"
                />
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2"
                >
                  Teléfono <span className="normal-case tracking-normal">(opcional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="300 123 4567"
                  className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-kore-gray-dark/30 hover:text-kore-gray-dark/60 transition-colors text-sm cursor-pointer"
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="passwordConfirm"
                  className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2"
                >
                  Confirmar contraseña
                </label>
                <input
                  id="passwordConfirm"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark placeholder:text-kore-gray-dark/30 text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors"
                />
              </div>

              {/* reCAPTCHA */}
              {siteKey && (
                <div className="flex justify-center">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={siteKey}
                    onChange={(token) => setCaptchaToken(token)}
                    onExpired={() => setCaptchaToken(null)}
                  />
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Validando datos...
                  </span>
                ) : (
                  'Continuar'
                )}
              </button>
            </form>
          )}

          {/* Step 2: Verification Code */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <p className="text-sm text-kore-gray-dark/60 text-center">
                Enviamos un código de 6 dígitos a <strong className="text-kore-gray-dark">{email}</strong>
              </p>

              <div>
                <label
                  htmlFor="verificationCode"
                  className="block text-xs font-medium tracking-widest uppercase text-kore-gray-dark/40 mb-2"
                >
                  Código de verificación
                </label>
                <input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg bg-kore-cream/80 border border-kore-gray-light/60 text-kore-gray-dark text-sm focus:outline-none focus:border-kore-red/40 focus:ring-1 focus:ring-kore-red/20 transition-colors text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>

              {countdown > 0 && (
                <p className="text-xs text-kore-gray-dark/40 text-center">
                  El código expira en <strong>{formatCountdown(countdown)}</strong>
                </p>
              )}
              {countdown === 0 && step === 'verify' && (
                <p className="text-xs text-kore-red/70 text-center">
                  El código ha expirado. Solicita uno nuevo.
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verificando...
                  </span>
                ) : (
                  'Verificar código'
                )}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isLoading}
                  className="text-sm text-kore-gray-dark/50 hover:text-kore-red transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Reenviar código
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('form'); setCode(''); setError(''); setSuccess(''); }}
                  disabled={isLoading}
                  className="text-sm text-kore-gray-dark/50 hover:text-kore-red transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Volver al formulario
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer text */}
        <p data-hero="cta" className="text-center text-xs text-kore-gray-dark/30 mt-8">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-kore-red hover:text-kore-red-dark transition-colors">
            Inicia sesión
          </Link>
        </p>
      </div>
    </section>
  );
}
