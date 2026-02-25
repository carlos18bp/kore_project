'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReCAPTCHA from 'react-google-recaptcha';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { useAuthStore } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';

const CHECKOUT_REGISTRATION_TOKEN_KEY = 'kore_checkout_registration_token';
const CHECKOUT_REGISTRATION_PACKAGE_KEY = 'kore_checkout_registration_package';

export default function RegisterClient() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState<string>('');
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const redirectTimeoutRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, hydrate, hydrated } = useAuthStore();

  const packageId = searchParams.get('package');

  useHeroAnimation(sectionRef);

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
      const { data } = await api.post<{ registration_token: string }>('/auth/pre-register/', {
        email,
        password,
        password_confirm: passwordConfirm,
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        captcha_token: captchaToken,
      });

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(CHECKOUT_REGISTRATION_TOKEN_KEY, data.registration_token);
        sessionStorage.setItem(CHECKOUT_REGISTRATION_PACKAGE_KEY, packageId);
      }

      router.push(`/checkout?package=${packageId}`);
      return;
    } catch (err) {
      const axiosErr = err as { response?: { data?: unknown } };
      const message = extractErrorMessage(axiosErr.response?.data);

      if (/ya existe una cuenta|already exists|already registered/i.test(message)) {
        setError('Ya existe una cuenta con este correo. Redirigiendo a iniciar sesión...');
        redirectTimeoutRef.current = window.setTimeout(() => {
          router.push('/login');
        }, 1000);
      } else {
        setError(message);
      }

      setIsLoading(false);
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    }
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
            Crea tu cuenta
          </p>
        </div>

        {/* Register Form Card */}
        <div data-hero="body" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-kore-gray-light/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3">
                <p className="text-sm text-kore-red">{error}</p>
              </div>
            )}

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
                'Continuar al pago'
              )}
            </button>
          </form>
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
