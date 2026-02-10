'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';

const pillars = [
  {
    title: 'Desde el origen',
    description:
      'Entrenamos desde el centro del movimiento. No comenzamos con ejercicios, sino con preguntas: ¿cómo se mueve tu cuerpo? ¿qué historia trae?',
    image: '/images/spiral.webp',
    alt: 'Espiral - origen del movimiento',
  },
  {
    title: 'Acompañamiento real',
    description:
      'No entrenamos cuerpos aislados. Acompañamos personas completas. Cada sesión se adapta a tu estado real y a tu evolución.',
    image: '/images/hands.webp',
    alt: 'Manos abiertas - acompañamiento',
  },
  {
    title: 'Conocimiento profundo',
    description:
      'Anatomía funcional, biomecánica aplicada, control motor y prevención de lesiones. Tu cuerpo merece ser entendido antes de ser exigido.',
    image: '/images/pose/pose-02.webp',
    alt: 'Estudio anatómico - conocimiento del cuerpo',
  },
];

export default function Philosophy() {
  const sectionRef = useRef<HTMLElement>(null);
  useTextReveal(sectionRef);

  return (
    <section ref={sectionRef} className="bg-kore-cream py-10 lg:py-12">
      <div className="w-full px-6 md:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span data-animate="fade-up" className="inline-block text-kore-red text-sm font-medium tracking-widest uppercase mb-4">
            Nuestra filosofía
          </span>
          <h2 data-animate="split-text" data-delay="0.1" className="text-3xl md:text-4xl lg:text-5xl mb-6">
            Salud que se construye desde el centro
          </h2>
          <p data-animate="fade-up" data-delay="0.2" className="text-lg text-kore-gray-dark/70 leading-relaxed">
            En KÓRE la salud no es un resultado final. Es un proceso que se
            construye sesión a sesión, donde cada decisión tiene sentido y cada
            movimiento construye algo más profundo.
          </p>
        </div>

        {/* Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {pillars.map((pillar, index) => (
            <div
              key={index}
              data-animate="fade-up"
              data-delay={`${index * 0.15}`}
              className="group flex flex-col items-center text-center"
            >
              <div className="relative w-48 h-48 lg:w-56 lg:h-56 mb-8 rounded-full overflow-hidden bg-kore-cream">
                <Image
                  src={pillar.image}
                  alt={pillar.alt}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <h3 className="text-xl lg:text-2xl mb-3">{pillar.title}</h3>
              <p className="text-kore-gray-dark/70 leading-relaxed max-w-sm">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
