'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useTextReveal } from '@/app/composables/useScrollAnimations';
import MobileSwiper from '@/app/components/MobileSwiper';

type Plan = {
  name: string;
  sessions: number;
  duration: string;
  pricePerSession: string;
  total: string;
};

type ProgramType = {
  id: string;
  name: string;
  shortName: string;
  mobileShortName: string;
  tagline: string;
  description: string;
  includes: string[];
  idealFor: string[];
  plans: Plan[];
  accent: string;
  accentBg: string;
  accentBorder: string;
};

const programTypes: ProgramType[] = [
  {
    id: 'personalizado',
    name: 'Personalizado FLW',
    shortName: 'Personalizado',
    mobileShortName: '1 a 1',
    tagline: 'Tu proceso. Tu ritmo.',
    description: 'Entrenamiento uno a uno, completamente guiado y adaptado a tu estado físico, tu historia corporal y tus objetivos. Cada fase está estructurada para desarrollar fuerza, movilidad y rendimiento de forma sostenible.',
    includes: [
      'Evaluación funcional inicial',
      'Planificación personalizada por fases',
      'Corrección técnica constante',
      'Progresión inteligente de cargas',
      'Seguimiento continuo del proceso',
    ],
    idealFor: [
      'Quienes buscan transformación real',
      'Objetivos específicos de fuerza o rendimiento',
      'Acompañamiento exclusivo y constante',
    ],
    accent: 'text-kore-red-bright',
    accentBg: 'bg-kore-red-bright',
    accentBorder: 'border-kore-red-bright',
    plans: [
      { name: 'Sesión Individual', sessions: 1, duration: '60 min', pricePerSession: '$85.000', total: '$85.000' },
      { name: 'Programa Básico', sessions: 4, duration: '60 min', pricePerSession: '$80.000', total: '$320.000' },
      { name: 'Programa Continuidad', sessions: 8, duration: '60 min', pricePerSession: '$75.000', total: '$600.000' },
      { name: 'Programa Avance', sessions: 12, duration: '60 min', pricePerSession: '$70.000', total: '$840.000' },
      { name: 'Programa Consolidación', sessions: 16, duration: '60 min', pricePerSession: '$65.000', total: '$1.040.000' },
      { name: 'Programa Integral', sessions: 20, duration: '60 min', pricePerSession: '$60.000', total: '$1.200.000' },
    ],
  },
  {
    id: 'semi',
    name: 'Semi-personalizado FLW',
    shortName: 'Semi-personalizado',
    mobileShortName: '2-3 pers.',
    tagline: 'Evolucionar en compañía, progresar con método.',
    description: 'Entrenamiento en grupos reducidos (2 a 3 personas), manteniendo supervisión técnica individual dentro del entorno grupal. Combina estructura profesional con energía colectiva.',
    includes: [
      'Evaluación básica individual',
      'Plan estructurado en grupo reducido',
      'Corrección técnica personalizada',
      'Progresión controlada',
      'Trabajo funcional integral',
    ],
    idealFor: [
      'Entrenar acompañado sin perder calidad',
      'Mayor motivación y adherencia',
      'Costo más accesible con supervisión',
    ],
    accent: 'text-kore-red-light',
    accentBg: 'bg-kore-red-light',
    accentBorder: 'border-kore-red-light',
    plans: [
      { name: 'Programa Inicial', sessions: 4, duration: '60 min', pricePerSession: '$60.000', total: '$240.000' },
      { name: 'Programa Continuidad', sessions: 8, duration: '60 min', pricePerSession: '$55.000', total: '$440.000' },
      { name: 'Programa Avance', sessions: 12, duration: '60 min', pricePerSession: '$50.000', total: '$600.000' },
      { name: 'Programa Consolidación', sessions: 16, duration: '60 min', pricePerSession: '$47.500', total: '$760.000' },
      { name: 'Programa Integral', sessions: 20, duration: '60 min', pricePerSession: '$45.000', total: '$900.000' },
    ],
  },
  {
    id: 'terapeutico',
    name: 'Terapéutico FLW',
    shortName: 'Terapéutico',
    mobileShortName: 'Terapia',
    tagline: 'Recuperar el movimiento. Restaurar el equilibrio.',
    description: 'Programa enfocado en mejorar movilidad, reducir molestias y optimizar patrones de movimiento mediante ejercicio terapéutico estructurado. En KÓRE trabajamos desde la causa del desequilibrio, reeducando el cuerpo para prevenir recaídas y fortalecer desde la base.',
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
    accent: 'text-kore-red-lightest',
    accentBg: 'bg-kore-red-lightest',
    accentBorder: 'border-kore-red-lightest',
    plans: [
      { name: 'Sesión Terapéutica', sessions: 1, duration: '60 min', pricePerSession: '$95.000', total: '$95.000' },
      { name: 'Programa Terapéutico', sessions: 4, duration: '60 min', pricePerSession: '$90.000', total: '$360.000' },
      { name: 'Programa Recuperación', sessions: 8, duration: '60 min', pricePerSession: '$85.000', total: '$680.000' },
      { name: 'Programa Funcional', sessions: 12, duration: '60 min', pricePerSession: '$80.000', total: '$960.000' },
      { name: 'Programa Integral', sessions: 20, duration: '60 min', pricePerSession: '$75.000', total: '$1.500.000' },
    ],
  },
];

export default function PricingTable() {
  const [activeTab, setActiveTab] = useState(0);
  const active = programTypes[activeTab];
  const sectionRef = useRef<HTMLElement>(null);
  useTextReveal(sectionRef);

  return (
    <section ref={sectionRef} className="bg-kore-cream py-10 lg:py-12 overflow-hidden">
      <div className="w-full px-5 md:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <span data-animate="fade-up" className="inline-block text-kore-red text-xs md:text-sm font-medium tracking-widest uppercase mb-3 md:mb-6">
            Tarifas 2026
          </span>
          <h2 data-animate="split-text" data-delay="0.1" className="text-xl sm:text-2xl md:text-4xl lg:text-5xl mb-6 md:mb-8 leading-tight">
            Invierte en tu salud
          </h2>
          <p data-animate="fade-up" data-delay="0.2" className="text-sm md:text-lg text-kore-gray-dark/70 leading-relaxed">
            Todos los programas incluyen sesiones presenciales de 60 minutos a
            domicilio. KÓRE proporciona todo el material necesario.
          </p>
        </div>

        {/* ===== MOBILE: Compact Program Cards ===== */}
        <div data-animate="fade-up" data-delay="0.3" className="md:hidden flex flex-col gap-3 mb-6">
          {programTypes.map((program, index) => {
            /* istanbul ignore next */
            const minPrice = program.plans[0]?.total ?? '';
            return (
              <Link
                key={program.id}
                href={`/programs?program=${index}`}
                className={`flex items-center gap-4 bg-white rounded-2xl p-4 border border-kore-gray-light/60 shadow-sm active:scale-[0.98] transition-all`}
              >
                <div className={`w-11 h-11 rounded-xl ${program.accentBg} flex items-center justify-center flex-shrink-0`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading text-sm font-bold text-kore-gray-dark truncate">
                    {program.name.replace(' FLW', '')}
                  </h3>
                  <p className="text-xs text-kore-gray-dark/50 mt-0.5">
                    Desde <span className={`font-bold ${program.accent}`}>{minPrice}</span>
                  </p>
                </div>
                <svg className="w-4 h-4 text-kore-gray-dark/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            );
          })}
        </div>

        {/* ===== DESKTOP: Full pricing experience ===== */}
        {/* Program Type Tabs */}
        <div data-animate="fade-up" data-delay="0.3" className="hidden md:block mb-8 md:mb-12">
          <div className="flex justify-center gap-3">
            {programTypes.map((program, index) => (
              <button
                key={program.id}
                onClick={() => setActiveTab(index)}
                className={`px-8 py-4 rounded-xl text-sm font-medium tracking-wide uppercase transition-all duration-300 whitespace-nowrap ${
                  activeTab === index
                    ? `${program.accentBg} text-white shadow-lg`
                    : 'bg-kore-cream text-kore-gray-dark hover:bg-kore-gray-light'
                }`}
              >
                {program.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Active Program Info - Desktop Only */}
        <div data-animate="fade-up" data-delay="0.2" className="hidden md:block max-w-5xl mx-auto mb-8 md:mb-12">
          <div className="text-center mb-6 md:mb-8">
            <h3 className={`text-xl md:text-3xl font-heading font-semibold ${active.accent} mb-2 md:mb-3`}>
              {active.name}
            </h3>
            <p className="text-sm md:text-lg text-kore-gray-dark/80 italic mb-3 md:mb-4">{active.tagline}</p>
            <p className="text-sm md:text-base text-kore-gray-dark/70 leading-relaxed max-w-2xl mx-auto">
              {active.description}
            </p>
          </div>

          {/* Includes & Ideal For */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 bg-white rounded-2xl p-5 md:p-8 border border-kore-gray-light">
            <div>
              <h4 className="text-sm font-medium tracking-widest uppercase text-kore-gray-dark/50 mb-4">Incluye</h4>
              <ul className="space-y-3">
                {active.includes.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full ${active.accentBg}/10 flex items-center justify-center mt-0.5`}>
                      <svg className={`w-3 h-3 ${active.accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm text-kore-gray-dark/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium tracking-widest uppercase text-kore-gray-dark/50 mb-4">Ideal para</h4>
              <ul className="space-y-3">
                {active.idealFor.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full ${active.accentBg}/10 flex items-center justify-center mt-0.5`}>
                      <svg className={`w-3 h-3 ${active.accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm text-kore-gray-dark/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Pricing Cards - Desktop grid */}
        <div data-animate="stagger-children" data-delay="0.3" className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {active.plans.map((plan, index) => {
            const isPopular = index === Math.floor(active.plans.length / 2);
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all duration-300 ${
                  isPopular
                    ? `border-2 ${active.accentBorder} bg-white shadow-xl scale-[1.02] mt-4`
                    : 'border border-kore-gray-light bg-white hover:shadow-lg'
                }`}
              >
                {isPopular && (
                  <span className={`inline-block self-center ${active.accentBg} text-white text-xs font-medium tracking-wide uppercase px-4 py-1 rounded-full mb-3`}>Más elegido</span>
                )}
                <p className="text-sm text-kore-gray-dark/50 uppercase tracking-wide mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className={`font-heading text-4xl font-semibold ${active.accent}`}>{plan.sessions}</span>
                  <span className="text-kore-gray-dark/60 text-sm">{plan.sessions === 1 ? 'sesión' : 'sesiones'}</span>
                </div>
                <div className="border-t border-kore-gray-light my-4" />
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm"><span className="text-kore-gray-dark/60">Duración</span><span className="font-medium text-kore-gray-dark">{plan.duration}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-kore-gray-dark/60">Valor por sesión</span><span className="font-medium text-kore-gray-dark">{plan.pricePerSession}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-kore-gray-dark/60">Valor total</span><span className={`font-semibold text-lg ${active.accent}`}>{plan.total}</span></div>
                </div>
                <a href="#diagnostico" className={`block w-full text-center py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isPopular ? `${active.accentBg} text-white hover:opacity-90` : `border-2 ${active.accentBorder} ${active.accent} hover:bg-kore-wine-dark hover:border-kore-wine-dark hover:text-white`}`}>Comenzar</a>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div data-animate="fade-up" data-delay="0.4" className="text-center mt-8 md:mt-12 max-w-2xl mx-auto">
          <p className="text-xs md:text-sm text-kore-gray-dark/50 leading-relaxed">
            Programas con contrato mensual. Vigencia desde el día de inicio
            hasta el mismo día del mes siguiente. El diagnóstico inicial es
            gratuito y sin compromiso.
          </p>
        </div>
      </div>
    </section>
  );
}
