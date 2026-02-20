'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReCAPTCHA from 'react-google-recaptcha';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { useAuthStore } from '@/lib/stores/authStore';
import { WHATSAPP_URL } from '@/lib/constants';
import { api } from '@/lib/services/http';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState<string>('');
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const { login, isAuthenticated, hydrate, hydrated } = useAuthStore();

  useHeroAnimation(sectionRef);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    api.get('/google-captcha/site-key/')
      .then((res) => {
        console.log('Captcha site key loaded:', res.data.site_key);
        setSiteKey(res.data.site_key);
      })
      .catch((err) => {
        console.warn('Could not load captcha site key:', err?.response?.status, err?.message);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (siteKey && !captchaToken) {
      setError('Por favor completa el captcha');
      return;
    }

    setIsLoading(true);

    const result = await login(email, password, captchaToken ?? undefined);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Error al iniciar sesión');
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

      <div className="w-full max-w-md mx-auto px-6 py-16">
        {/* Logo / Brand */}
        <div data-hero="badge" className="text-center mb-10">
          <Link href="/">
            <span className="font-heading text-5xl font-semibold text-kore-gray-dark tracking-tight">
              KÓRE
            </span>
          </Link>
          <p data-hero="subtitle" className="text-kore-gray-dark/50 text-sm mt-2 tracking-wide">
            Accede a tu espacio personal
          </p>
        </div>

        {/* Login Form Card */}
        <div data-hero="body" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-kore-gray-light/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3">
                <p className="text-sm text-kore-red">{error}</p>
              </div>
            )}

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

            {/* Forgot password */}
            <div className="flex justify-end">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-kore-gray-dark/40 hover:text-kore-red transition-colors"
              >
                ¿Olvidaste tu contraseña? Contáctanos
              </a>
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
              className="w-full bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ingresando...
                </span>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-kore-gray-light/60" />
            <span className="text-xs text-kore-gray-dark/30 uppercase tracking-wide">o</span>
            <div className="flex-1 h-px bg-kore-gray-light/60" />
          </div>

          {/* WhatsApp contact */}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 border border-kore-gray-light/60 text-kore-gray-dark/60 hover:text-kore-gray-dark hover:border-kore-gray-dark/20 font-medium py-3.5 rounded-lg transition-colors duration-200 text-sm"
          >
            Contactar por WhatsApp
          </a>
        </div>

        {/* Footer text */}
        <p data-hero="cta" className="text-center text-xs text-kore-gray-dark/30 mt-8">
          ¿Aún no tienes cuenta?{' '}
          <Link href="/register" className="text-kore-red hover:text-kore-red-dark transition-colors">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </section>
  );
}
