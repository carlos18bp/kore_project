'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHeroAnimation, useTextReveal } from '@/app/composables/useScrollAnimations';
import { useAuthStore } from '@/lib/stores/authStore';
import { api } from '@/lib/services/http';

type ApiPackage = {
  id: number;
  title: string;
  category: string;
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  currency: string;
  validity_days: number;
};

type ProgramMeta = {
  category: string;
  name: string;
  tagline: string;
  subtitle: string;
  description: string;
  includes: string[];
  idealFor: string[];
  image: string;
  alt: string;
  accent: string;
  accentText: string;
  accentBorder: string;
  mobileLabel: string;
};

const programMeta: ProgramMeta[] = [
  {
    category: 'personalizado',
    name: 'Personalizado FLW',
    tagline: 'Tu proceso. Tu ritmo.',
    subtitle: 'Sesiones 1:1',
    description:
      'Un proceso 1:1 diseñado para quienes buscan precisión, seguimiento cercano y máxima adaptación a sus necesidades. Cada fase está estructurada para desarrollar fuerza, movilidad y rendimiento de forma sostenible.',
    includes: [
      'Evaluación funcional inicial',
      'Planificación personalizada por fases',
      'Corrección técnica constante',
      'Progresión inteligente de cargas',
      'Seguimiento continuo del proceso',
    ],
    idealFor: [
      'Objetivos específicos de fuerza o rendimiento',
      'Procesos de transformación real',
      'Recuperación y mejora profunda',
    ],
    image: '/images/flower_leaves.webp',
    alt: 'Pétalos cayendo — Programa Personalizado',
    accent: 'bg-kore-red-bright',
    accentText: 'text-kore-red-bright',
    accentBorder: 'border-kore-red-bright',
    mobileLabel: 'Personal',
  },
  {
    category: 'semi_personalizado',
    name: 'Semi-personalizado FLW',
    tagline: 'Evolucionar en compañía, progresar con método.',
    subtitle: '2–3 personas',
    description:
      'Entrena acompañado manteniendo objetivos individuales en un entorno motivador y guiado. Combina estructura profesional con energía colectiva.',
    includes: [
      'Evaluación básica individual',
      'Plan estructurado en grupo reducido',
      'Corrección técnica personalizada',
      'Progresión controlada',
      'Trabajo funcional integral',
    ],
    idealFor: [
      'Constancia y adherencia al proceso',
      'Entrenar acompañado sin perder calidad',
      'Costo más accesible con supervisión',
    ],
    image: '/images/pose.webp',
    alt: 'Pose en movimiento — Programa Semi-personalizado',
    accent: 'bg-kore-red-light',
    accentText: 'text-kore-red-light',
    accentBorder: 'border-kore-red-light',
    mobileLabel: 'Semi',
  },
  {
    category: 'terapeutico',
    name: 'Terapéutico FLW',
    tagline: 'Recuperar el movimiento. Restaurar el equilibrio.',
    subtitle: 'Movimiento consciente',
    description:
      'Un enfoque de movimiento consciente para personas con dolor, lesiones o limitaciones que buscan recuperar función y confianza en su cuerpo. En KÓRE trabajamos desde la causa del desequilibrio.',
    includes: [
      'Evaluación funcional y postural',
      'Identificación de desbalances musculares',
      'Ejercicio terapéutico específico',
      'Fortalecimiento progresivo',
      'Estrategias preventivas',
    ],
    idealFor: [
      'Procesos de recuperación o rehabilitación',
      'Molestias recurrentes o dolor crónico',
      'Prevención y reeducación corporal',
    ],
    image: '/images/hands.webp',
    alt: 'Manos abiertas — Programa Terapéutico',
    accent: 'bg-kore-red-lightest',
    accentText: 'text-kore-red-lightest',
    accentBorder: 'border-kore-red-lightest',
    mobileLabel: 'Terapéutico',
  },
];

function formatPrice(value: number) {
  return '$' + value.toLocaleString('en-US');
}

export default function ProgramsPage() {
  const [active, setActive] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [packagesByCategory, setPackagesByCategory] = useState<Record<string, ApiPackage[]>>({});
  const [loading, setLoading] = useState(true);
  const heroRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { isAuthenticated, hydrate, hydrated } = useAuthStore();

  useHeroAnimation(heroRef);
  useTextReveal(cardsRef);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    api.get<{ results?: ApiPackage[] } | ApiPackage[]>('/packages/')
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data.results ?? []);
        const grouped: Record<string, ApiPackage[]> = {};
        for (const pkg of list) {
          if (!grouped[pkg.category]) grouped[pkg.category] = [];
          grouped[pkg.category].push(pkg);
        }
        setPackagesByCategory(grouped);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const current = programMeta[active];
  const plans = packagesByCategory[current.category] ?? [];

  function handleProgramChange(index: number) {
    setActive(index);
    setSelectedPlan(null);
  }

  const selectedPkg = selectedPlan !== null ? plans[selectedPlan] : null;

  return (
    <main className="bg-kore-cream">
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col lg:flex-row items-stretch overflow-hidden"
      >
        {/* Left — Content + Plans */}
        <div className="flex-1 flex items-start px-6 md:px-10 lg:px-14 pt-28 lg:pt-32 pb-24 z-10 overflow-y-auto">
          <div className="max-w-xl w-full">
            <span
              data-hero="badge"
              className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase mb-4"
            >
              Programas
            </span>

            {/* Program Switch Tabs */}
            <div className="flex gap-1 p-1.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm mb-8 w-fit">
              {programMeta.map((program, index) => (
                <button
                  key={program.category}
                  onClick={() => handleProgramChange(index)}
                  className={`relative px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                    active === index
                      ? 'bg-white text-kore-gray-dark shadow-md'
                      : 'text-kore-gray-dark/60 hover:text-kore-gray-dark hover:bg-white/30'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                        active === index ? program.accent : 'bg-kore-gray-dark/20'
                      }`}
                    />
                    <span className="hidden sm:inline">{program.name.replace(' FLW', '')}</span>
                    <span className="sm:hidden">{program.mobileLabel}</span>
                  </span>
                </button>
              ))}
            </div>

            <p data-hero="subtitle" className="text-sm text-kore-gray-dark/60 leading-relaxed mb-8">
              Tu programa no se elige por catálogo. Se define según tu diagnóstico y tus objetivos.
            </p>

            <h1 data-hero="heading" className="font-heading text-2xl md:text-3xl lg:text-4xl text-kore-gray-dark tracking-tight mb-2">
              {current.name}
            </h1>

            <p className="font-heading text-base text-kore-burgundy font-semibold italic mb-4">
              {current.tagline}
            </p>

            <p data-hero="body" className="text-sm text-kore-gray-dark/70 leading-relaxed mb-6">
              {current.description}
            </p>

            {/* Includes & Ideal For */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 p-5 bg-white/60 rounded-2xl border border-kore-gray-light/30">
              <div>
                <h4 className="text-[10px] font-medium tracking-widest uppercase text-kore-gray-dark/50 mb-3">Incluye</h4>
                <ul className="space-y-2">
                  {current.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg className={`w-3.5 h-3.5 ${current.accentText} flex-shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs text-kore-gray-dark/70">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-medium tracking-widest uppercase text-kore-gray-dark/50 mb-3">Ideal para</h4>
                <ul className="space-y-2">
                  {current.idealFor.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg className={`w-3.5 h-3.5 ${current.accentText} flex-shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs text-kore-gray-dark/70">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-wrap gap-3">
              <a
                href="/kore-brand"
                className="inline-flex items-center gap-2 text-xs font-medium text-kore-gray-dark/60 hover:text-kore-red transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ver detalles del método
              </a>
              <a
                href="https://wa.me/573238122373"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-kore-gray-dark/60 hover:text-kore-red transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 448 512" fill="currentColor">
                  <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157m-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1s56.2 81.2 56.1 130.5c0 101.8-84.9 184.6-186.6 184.6m101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8s-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7s-12.5-30.1-17.1-41.2c-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2s-9.7 1.4-14.8 6.9c-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4s4.6-24.1 3.2-26.4c-1.3-2.5-5-3.9-10.5-6.6"/>
                </svg>
                Agenda tu valoración
              </a>
            </div>
          </div>
        </div>

        {/* Right — Pricing Cards */}
        <div data-hero="body" className="flex-1 flex items-start px-6 md:px-10 lg:px-14 pt-28 lg:pt-32 pb-24 z-10 overflow-y-auto">
          <div ref={cardsRef} className="w-full">
            {/* Header */}
            <div data-animate="fade-up" className="mb-8">
              <span className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase mb-2">
                Tarifas 2026
              </span>
              <h2 className="font-heading text-xl md:text-2xl text-kore-gray-dark tracking-tight">
                Elige tu plan
              </h2>
            </div>

            {/* Pricing Cards Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-6 w-6 text-kore-red" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : plans.length === 0 ? (
              <p className="text-sm text-kore-gray-dark/40 text-center py-8">
                No hay planes disponibles para este programa.
              </p>
            ) : (
              <div data-animate="stagger-children" data-delay="0.2" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {plans.map((pkg, i) => {
                  const isSelected = selectedPlan === i;
                  const price = parseFloat(pkg.price);
                  const pricePerSession = Math.round(price / pkg.sessions_count);
                  const isPopular = i === Math.floor(plans.length / 2);

                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPlan(i)}
                      className={`relative text-left rounded-2xl p-6 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? `border-2 ${current.accentBorder} bg-white shadow-xl scale-[1.02]`
                          : isPopular
                            ? `border-2 ${current.accentBorder} bg-white shadow-lg`
                            : 'border border-kore-gray-light bg-white hover:shadow-lg'
                      }`}
                    >
                      {isPopular && (
                        <span
                          className={`absolute -top-3 left-1/2 -translate-x-1/2 ${current.accent} text-white text-[10px] font-medium tracking-wide uppercase px-3 py-1 rounded-full`}
                        >
                          Más elegido
                        </span>
                      )}

                      {/* Plan Name */}
                      <p className="text-[10px] text-kore-gray-dark/50 uppercase tracking-wide mb-1">
                        {pkg.title}
                      </p>

                      {/* Sessions */}
                      <div className="flex items-baseline gap-1.5 mb-3">
                        <span className={`font-heading text-3xl font-semibold ${current.accentText}`}>
                          {pkg.sessions_count}
                        </span>
                        <span className="text-kore-gray-dark/60 text-xs">
                          {pkg.sessions_count === 1 ? 'sesión' : 'sesiones'}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-kore-gray-light my-3" />

                      {/* Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-kore-gray-dark/60">Duración</span>
                          <span className="font-medium text-kore-gray-dark">{pkg.session_duration_minutes} min</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-kore-gray-dark/60">Valor por sesión</span>
                          <span className="font-medium text-kore-gray-dark">{formatPrice(pricePerSession)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-kore-gray-dark/60">Valor total</span>
                          <span className={`font-semibold text-base ${current.accentText}`}>
                            {formatPrice(price)}
                          </span>
                        </div>
                      </div>

                      {/* Selection indicator */}
                      <div
                        className={`w-full text-center py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                          isSelected
                            ? `${current.accent} text-white`
                            : `border ${current.accentBorder} ${current.accentText}`
                        }`}
                      >
                        {isSelected ? 'Seleccionado' : 'Seleccionar'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* CTA */}
            {selectedPkg && (
              <div className="flex items-center gap-3 mt-8">
                <button
                  disabled={!hydrated}
                  onClick={() => {
                    if (!hydrated) {
                      return;
                    }
                    const destination = isAuthenticated
                      ? `/checkout?package=${selectedPkg.id}`
                      : `/register?package=${selectedPkg.id}`;
                    router.push(destination);
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-kore-red text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-kore-red-dark transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Reservar {selectedPkg.title}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
                <span className="text-sm text-kore-gray-dark/40">
                  {formatPrice(parseFloat(selectedPkg.price))}
                </span>
              </div>
            )}

            {/* Footer note */}
            <p className="text-[10px] text-kore-gray-dark/40 leading-relaxed mt-8">
              Programas con contrato mensual. Vigencia desde el día de inicio hasta el mismo día del mes siguiente.
              <br />
              Al reservar, aceptas nuestros{' '}
              <a href="/terms" className="underline hover:text-kore-red transition-colors">Términos y Condiciones</a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
