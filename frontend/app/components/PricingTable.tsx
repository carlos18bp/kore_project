'use client';

import { useState, useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';

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
  subtitle: string;
  description: string;
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
    subtitle: 'Sesiones individuales 1 a 1',
    description: 'El programa más profundo. Cada sesión se adapta a tu estado real.',
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
    subtitle: '2-3 personas · Valor por persona',
    description: 'Entrena en grupo reducido, guiado y consciente.',
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
    subtitle: 'Movimiento como herramienta terapéutica',
    description: 'Recuperación, rehabilitación y condiciones especiales.',
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
    <section ref={sectionRef} className="bg-kore-cream py-10 lg:py-12">
      <div className="w-full px-6 md:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span data-animate="fade-up" className="inline-block text-kore-red text-sm font-medium tracking-widest uppercase mb-4">
            Tarifas 2026
          </span>
          <h2 data-animate="split-text" data-delay="0.1" className="text-3xl md:text-4xl lg:text-5xl mb-6">
            Invierte en tu salud
          </h2>
          <p data-animate="fade-up" data-delay="0.2" className="text-lg text-kore-gray-dark/70 leading-relaxed">
            Todos los programas incluyen sesiones presenciales de 60 minutos a
            domicilio. KÓRE proporciona todo el material necesario.
          </p>
        </div>

        {/* Program Type Tabs */}
        <div data-animate="fade-up" data-delay="0.3" className="flex flex-col sm:flex-row justify-center gap-3 mb-12">
          {programTypes.map((program, index) => (
            <button
              key={program.id}
              onClick={() => setActiveTab(index)}
              className={`px-8 py-4 rounded-xl text-sm font-medium tracking-wide uppercase transition-all duration-300 ${
                activeTab === index
                  ? `${program.accentBg} text-white shadow-lg`
                  : 'bg-kore-cream text-kore-gray-dark hover:bg-kore-gray-light'
              }`}
            >
              {program.shortName}
            </button>
          ))}
        </div>

        {/* Active Program Info */}
        <div data-animate="fade-up" data-delay="0.2" className="text-center mb-10">
          <h3 className={`text-2xl md:text-3xl font-heading font-semibold ${active.accent} mb-2`}>
            {active.name}
          </h3>
          <p className="text-kore-gray-dark/60">{active.subtitle}</p>
        </div>

        {/* Pricing Cards Grid */}
        <div data-animate="stagger-children" data-delay="0.3" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {active.plans.map((plan, index) => {
            const isPopular =
              index === Math.floor(active.plans.length / 2);

            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all duration-300 ${
                  isPopular
                    ? `border-2 ${active.accentBorder} bg-white shadow-xl scale-[1.02]`
                    : 'border border-kore-gray-light bg-white hover:shadow-lg'
                }`}
              >
                {isPopular && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 ${active.accentBg} text-white text-xs font-medium tracking-wide uppercase px-4 py-1 rounded-full`}
                  >
                    Más elegido
                  </span>
                )}

                {/* Plan Name */}
                <p className="text-sm text-kore-gray-dark/50 uppercase tracking-wide mb-1">
                  {plan.name}
                </p>

                {/* Sessions */}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className={`font-heading text-4xl font-semibold ${active.accent}`}>
                    {plan.sessions}
                  </span>
                  <span className="text-kore-gray-dark/60 text-sm">
                    {plan.sessions === 1 ? 'sesión' : 'sesiones'}
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-kore-gray-light my-4" />

                {/* Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/60">Duración</span>
                    <span className="font-medium text-kore-gray-dark">{plan.duration}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/60">Valor por sesión</span>
                    <span className="font-medium text-kore-gray-dark">{plan.pricePerSession}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/60">Valor total</span>
                    <span className={`font-semibold text-lg ${active.accent}`}>
                      {plan.total}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <a
                  href="#diagnostico"
                  className={`block w-full text-center py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isPopular
                      ? `${active.accentBg} text-white hover:opacity-90`
                      : `border-2 ${active.accentBorder} ${active.accent} hover:${active.accentBg} hover:text-white`
                  }`}
                >
                  Comenzar
                </a>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div data-animate="fade-up" data-delay="0.4" className="text-center mt-12 max-w-2xl mx-auto">
          <p className="text-sm text-kore-gray-dark/50 leading-relaxed">
            Programas con contrato mensual. Vigencia desde el día de inicio
            hasta el mismo día del mes siguiente. El diagnóstico inicial es
            gratuito y sin compromiso.
          </p>
        </div>
      </div>
    </section>
  );
}
