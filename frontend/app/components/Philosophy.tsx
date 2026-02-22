'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';

const pillars = [
  {
    title: 'KÓRE',
    description:
      'El centro desde donde nace el movimiento. Aquí entendemos el cuerpo como un sistema conectado, no como partes aisladas.',
    image: '/images/spiral.webp',
    alt: 'Espiral - origen del movimiento',
  },
  {
    title: 'Health',
    description:
      'Bienestar real: moverse mejor, sentirse mejor y construir salud sostenible en el tiempo.',
    image: '/images/hands.webp',
    alt: 'Manos abiertas - acompañamiento',
  },
  {
    title: 'Nuestro enfoque',
    description:
      'Acompañamos personas completas, entendiendo su historia, su contexto y su cuerpo para diseñar procesos con sentido.',
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
          <span data-animate="fade-up" className="inline-block text-kore-red text-sm font-medium tracking-widest uppercase mb-6">
            Qué es KÓRE
          </span>
          <h2 data-animate="split-text" data-delay="0.1" className="text-3xl md:text-4xl lg:text-5xl mb-8">
            KÓRE representa el origen, el núcleo, el centro desde donde el cuerpo se organiza y se adapta.
          </h2>
          <p data-animate="fade-up" data-delay="0.2" className="text-lg text-kore-gray-dark/70 leading-relaxed">
            Es un enfoque donde el entrenamiento deja de ser una rutina para convertirse en un proceso de salud guiado.
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
                  sizes="(max-width: 1024px) 192px, 224px"
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

        {/* CTA Button */}
        <div data-animate="fade-up" data-delay="0.5" className="text-center mt-12">
          <a
            href="#valoracion"
            className="inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium px-8 py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
          >
            Agenda tu valoración
          </a>
        </div>
      </div>
    </section>
  );
}
