'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { useAuthStore } from '@/lib/stores/authStore';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isAuthenticated, hydrate } = useAuthStore();

  const packageId = searchParams.get('package');

  useHeroAnimation(sectionRef);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAuthenticated) {
      if (packageId) {
        router.push(`/checkout?package=${packageId}`);
      } else {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, router, packageId]);

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

    setIsLoading(true);

    const result = await register({
      email,
      password,
      password_confirm: passwordConfirm,
      first_name: firstName,
      last_name: lastName,
      phone: phone || undefined,
    });

    if (result.success) {
      if (packageId) {
        router.push(`/checkout?package=${packageId}`);
      } else {
        router.push('/dashboard');
      }
    } else {
      setError(result.error || 'Error al crear la cuenta');
      setIsLoading(false);
    }
  };

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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-kore-gray-dark/30 hover:text-kore-gray-dark/60 transition-colors text-sm"
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
                  Creando cuenta...
                </span>
              ) : (
                'Crear cuenta'
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
