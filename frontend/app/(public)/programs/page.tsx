'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
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
  image: string;
  alt: string;
  accent: string;
  mobileLabel: string;
};

const programMeta: ProgramMeta[] = [
  {
    category: 'personalizado',
    name: 'Personalizado FLW',
    tagline: 'Tu proceso, tu ritmo',
    subtitle: 'Uno a uno',
    description:
      'Sesiones uno a uno, completamente guiadas. Cada decisión se adapta a tu estado real, tu historia y tus objetivos.',
    image: '/images/flower_leaves.webp',
    alt: 'Pétalos cayendo — Programa Personalizado',
    accent: 'bg-kore-red-bright',
    mobileLabel: 'Personal',
  },
  {
    category: 'semi_personalizado',
    name: 'Semi-personalizado FLW',
    tagline: 'Comparte el camino',
    subtitle: '2–3 personas',
    description:
      'Grupos reducidos de 2 a 3 personas. Cada uno con objetivos propios, en un entorno cercano y guiado. Valor por persona.',
    image: '/images/pose.webp',
    alt: 'Pose en movimiento — Programa Semi-personalizado',
    accent: 'bg-kore-red-light',
    mobileLabel: 'Semi',
  },
  {
    category: 'terapeutico',
    name: 'Terapéutico FLW',
    tagline: 'Movimiento como medicina',
    subtitle: 'Sesiones presenciales',
    description:
      'El movimiento como herramienta terapéutica. Para quienes necesitan reconstruir la confianza en su cuerpo.',
    image: '/images/hands.webp',
    alt: 'Manos abiertas — Programa Terapéutico',
    accent: 'bg-kore-red-lightest',
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
  const router = useRouter();
  const { isAuthenticated, hydrate, hydrated } = useAuthStore();

  useHeroAnimation(heroRef);

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
        <div className="flex-1 flex items-center px-6 md:px-10 lg:px-14 py-24 lg:py-0 z-10 overflow-y-auto">
          <div className="max-w-xl w-full">
            <span
              data-hero="badge"
              className="inline-block text-kore-red text-xs font-medium tracking-[0.25em] uppercase mb-3"
            >
              Tarifas 2026
            </span>

            <h1 data-hero="heading" className="font-heading text-2xl md:text-3xl lg:text-4xl text-kore-gray-dark tracking-tight mb-1">
              {current.name}
            </h1>

            <p data-hero="subtitle" className="font-heading text-base text-kore-burgundy font-semibold mb-3">
              {current.tagline}
            </p>

            <p data-hero="body" className="text-sm text-kore-gray-dark/60 leading-relaxed mb-6">
              {current.description}
            </p>

            {/* Plans */}
            <div data-hero="cta" className="space-y-2.5 mb-20 lg:mb-10">
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
                plans.map((pkg, i) => {
                  const isSelected = selectedPlan === i;
                  const price = parseFloat(pkg.price);
                  const pricePerSession = Math.round(price / pkg.sessions_count);
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPlan(i)}
                      className={`w-full text-left rounded-xl p-4 border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-white border-kore-red/30 shadow-md ring-1 ring-kore-red/20'
                          : 'bg-white/50 border-kore-gray-light/40 hover:bg-white/80 hover:border-kore-gray-light/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Left info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${
                              isSelected
                                ? 'border-kore-red bg-kore-red'
                                : 'border-kore-gray-dark/20 bg-transparent'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-kore-gray-dark truncate">
                              {pkg.title}
                            </p>
                            <p className="text-xs text-kore-gray-dark/40">
                              {pkg.sessions_count} {pkg.sessions_count === 1 ? 'sesión' : 'sesiones'} · {pkg.session_duration_minutes} min
                            </p>
                          </div>
                        </div>

                        {/* Right price */}
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${isSelected ? 'text-kore-red' : 'text-kore-gray-dark'}`}>
                            {formatPrice(price)}
                          </p>
                          <p className="text-[11px] text-kore-gray-dark/40">
                            {formatPrice(pricePerSession)}/sesión
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* CTA */}
            {selectedPkg && (
              <div className="flex items-center gap-3 mb-10 lg:mb-0">
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
          </div>
        </div>

        {/* Right — Image */}
        <div data-hero="body" className="relative w-full lg:w-1/2 h-[40vh] lg:h-screen flex-shrink-0 order-first lg:order-last">
          {programMeta.map((program, index) => (
            <div
              key={program.category}
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: active === index ? 1 : 0 }}
            >
              <Image
                src={program.image}
                alt={program.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain object-center"
                priority={index === 0}
              />
            </div>
          ))}
          {/* Rounded vignette fade to kore-cream */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 65% 60% at center, transparent 45%, #EDE8DC 100%)' }}
          />
        </div>

        {/* Bottom — Glass Switch */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-6 lg:pb-8 pointer-events-none">
          <div className="flex gap-1 p-1.5 rounded-full bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg pointer-events-auto">
            {programMeta.map((program, index) => (
              <button
                key={program.category}
                onClick={() => handleProgramChange(index)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer ${
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
        </div>
      </section>
    </main>
  );
}
