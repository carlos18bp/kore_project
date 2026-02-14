'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

interface Plan {
  name: string;
  sessions: number;
  duration: string;
  pricePerSession: number;
  totalPrice: number;
}

const programs = [
  {
    id: 'personalizado',
    name: 'Personalizado FLW',
    tagline: 'Tu proceso, tu ritmo',
    subtitle: 'Uno a uno',
    description:
      'Sesiones uno a uno, completamente guiadas. Cada decisión se adapta a tu estado real, tu historia y tus objetivos.',
    image: '/images/flower_leaves.webp',
    alt: 'Pétalos cayendo — Programa Personalizado',
    accent: 'bg-kore-red-bright',
    plans: [
      { name: 'Sesión Individual', sessions: 1, duration: '60 min', pricePerSession: 85000, totalPrice: 85000 },
      { name: 'Programa Básico', sessions: 4, duration: '60 min', pricePerSession: 80000, totalPrice: 320000 },
      { name: 'Programa Continuidad', sessions: 8, duration: '60 min', pricePerSession: 75000, totalPrice: 600000 },
      { name: 'Programa Avance', sessions: 12, duration: '60 min', pricePerSession: 70000, totalPrice: 840000 },
      { name: 'Programa Consolidación', sessions: 16, duration: '60 min', pricePerSession: 65000, totalPrice: 1040000 },
      { name: 'Programa Integral', sessions: 20, duration: '60 min', pricePerSession: 60000, totalPrice: 1200000 },
    ] as Plan[],
  },
  {
    id: 'semi',
    name: 'Semi-personalizado FLW',
    tagline: 'Comparte el camino',
    subtitle: '2–3 personas',
    description:
      'Grupos reducidos de 2 a 3 personas. Cada uno con objetivos propios, en un entorno cercano y guiado. Valor por persona.',
    image: '/images/pose.webp',
    alt: 'Pose en movimiento — Programa Semi-personalizado',
    accent: 'bg-kore-red-light',
    plans: [
      { name: 'Programa Inicial', sessions: 4, duration: '60 min', pricePerSession: 60000, totalPrice: 240000 },
      { name: 'Programa Continuidad', sessions: 8, duration: '60 min', pricePerSession: 55000, totalPrice: 440000 },
      { name: 'Programa Avance', sessions: 12, duration: '60 min', pricePerSession: 50000, totalPrice: 600000 },
      { name: 'Programa Consolidación', sessions: 16, duration: '60 min', pricePerSession: 47500, totalPrice: 760000 },
      { name: 'Programa Integral', sessions: 20, duration: '60 min', pricePerSession: 45000, totalPrice: 900000 },
    ] as Plan[],
  },
  {
    id: 'terapeutico',
    name: 'Terapéutico FLW',
    tagline: 'Movimiento como medicina',
    subtitle: 'Sesiones presenciales',
    description:
      'El movimiento como herramienta terapéutica. Para quienes necesitan reconstruir la confianza en su cuerpo.',
    image: '/images/hands.webp',
    alt: 'Manos abiertas — Programa Terapéutico',
    accent: 'bg-kore-red-lightest',
    plans: [
      { name: 'Sesión Terapéutica', sessions: 1, duration: '60 min', pricePerSession: 95000, totalPrice: 95000 },
      { name: 'Programa Terapéutico', sessions: 4, duration: '60 min', pricePerSession: 90000, totalPrice: 360000 },
      { name: 'Programa Recuperación', sessions: 8, duration: '60 min', pricePerSession: 85000, totalPrice: 680000 },
      { name: 'Programa Funcional', sessions: 12, duration: '60 min', pricePerSession: 80000, totalPrice: 960000 },
      { name: 'Programa Integral', sessions: 20, duration: '60 min', pricePerSession: 75000, totalPrice: 1500000 },
    ] as Plan[],
  },
];

function formatPrice(value: number) {
  return '$' + value.toLocaleString('es-CO');
}

export default function ProgramasPage() {
  const [active, setActive] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  useHeroAnimation(heroRef);

  const current = programs[active];

  function handleProgramChange(index: number) {
    setActive(index);
    setSelectedPlan(null);
  }

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
              {current.plans.map((plan, i) => {
                const isSelected = selectedPlan === i;
                return (
                  <button
                    key={plan.name}
                    onClick={() => setSelectedPlan(i)}
                    className={`w-full text-left rounded-xl p-4 border transition-all duration-200 ${
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
                            {plan.name}
                          </p>
                          <p className="text-xs text-kore-gray-dark/40">
                            {plan.sessions} {plan.sessions === 1 ? 'sesión' : 'sesiones'} · {plan.duration}
                          </p>
                        </div>
                      </div>

                      {/* Right price */}
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${isSelected ? 'text-kore-red' : 'text-kore-gray-dark'}`}>
                          {formatPrice(plan.totalPrice)}
                        </p>
                        <p className="text-[11px] text-kore-gray-dark/40">
                          {formatPrice(plan.pricePerSession)}/sesión
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* CTA */}
            {selectedPlan !== null && (
              <div className="flex items-center gap-3 mb-10 lg:mb-0">
                <a
                  href={`/register?package=${current.id}`}
                  className="inline-flex items-center justify-center gap-2 bg-kore-red text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-kore-red-dark transition-colors"
                >
                  Reservar {current.plans[selectedPlan].name}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
                <span className="text-sm text-kore-gray-dark/40">
                  {formatPrice(current.plans[selectedPlan].totalPrice)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right — Image */}
        <div data-hero="body" className="relative w-full lg:w-1/2 h-[40vh] lg:h-screen flex-shrink-0 order-first lg:order-last">
          {programs.map((program, index) => (
            <div
              key={program.id}
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: active === index ? 1 : 0 }}
            >
              <Image
                src={program.image}
                alt={program.alt}
                fill
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
        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-6 lg:pb-8">
          <div className="flex gap-1 p-1.5 rounded-full bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg">
            {programs.map((program, index) => (
              <button
                key={program.id}
                onClick={() => handleProgramChange(index)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
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
                  <span className="sm:hidden">{program.id === 'semi' ? 'Semi' : program.id === 'terapeutico' ? 'Terapéutico' : 'Personal'}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
