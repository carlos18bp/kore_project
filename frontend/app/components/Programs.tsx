'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';

const programs = [
  {
    name: 'Personalizado FLW',
    tagline: 'Tu proceso, tu ritmo',
    description:
      'Sesiones uno a uno, completamente guiadas. Cada decisión se adapta a tu estado real, tu historia y tus objetivos. El programa más profundo de KÓRE.',
    features: [
      'Sesiones individuales 1 a 1',
      'Plan 100% personalizado',
      'Seguimiento y ajuste constante',
      'Ideal para objetivos específicos',
    ],
    image: '/images/pose/pose-05.webp',
    alt: 'Entrenamiento personalizado',
    accent: 'bg-kore-red-bright',
  },
  {
    name: 'Semi-personalizado FLW',
    tagline: 'Comparte el camino',
    description:
      'Entrena en un grupo reducido de 2 a 3 personas. Cada uno con objetivos propios, pero en un entorno cercano, guiado y consciente.',
    features: [
      'Grupos de 2-3 personas',
      'Acompañamiento técnico constante',
      'Mayor motivación y adherencia',
      'Costo más accesible',
    ],
    image: '/images/pose/pose-12.webp',
    alt: 'Entrenamiento semi-personalizado',
    accent: 'bg-kore-red-light',
  },
  {
    name: 'Terapéutico FLW',
    tagline: 'Movimiento como medicina',
    description:
      'El movimiento como herramienta terapéutica. Para procesos de recuperación, dolor crónico, rehabilitación y condiciones especiales.',
    features: [
      'Enfoque preventivo y terapéutico',
      'Readaptación física guiada',
      'Adultos mayores y postoperatorios',
      'El movimiento al servicio de la salud',
    ],
    image: '/images/pose/pose-10.webp',
    alt: 'Entrenamiento terapéutico',
    accent: 'bg-kore-red-lightest',
  },
];

export default function Programs() {
  const sectionRef = useRef<HTMLElement>(null);
  useTextReveal(sectionRef);

  return (
    <section ref={sectionRef} id="programas" className="bg-kore-cream py-10 lg:py-12">
      <div className="w-full px-6 md:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span data-animate="fade-up" className="inline-block text-kore-red text-sm font-medium tracking-widest uppercase mb-4">
            Programas FLW
          </span>
          <h2 data-animate="split-text" data-delay="0.1" className="text-3xl md:text-4xl lg:text-5xl mb-6">
            Tres caminos, un mismo centro
          </h2>
          <p data-animate="fade-up" data-delay="0.2" className="text-lg text-kore-gray-dark/70 leading-relaxed">
            Cada programa nace del mismo enfoque anatómico y funcional. Lo que
            cambia es la forma de acompañarte según lo que necesitas hoy.
          </p>
        </div>

        {/* Program Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {programs.map((program, index) => (
            <div
              key={index}
              data-animate="scale-in"
              data-delay={`${index * 0.15}`}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300"
            >
              {/* Image */}
              <div className="relative h-56 overflow-hidden">
                <Image
                  src={program.image}
                  alt={program.alt}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Content */}
              <div className="p-8">
                <span
                  className={`inline-block ${program.accent} text-white text-xs font-medium tracking-wide uppercase px-3 py-1 rounded-full mb-4`}
                >
                  {program.tagline}
                </span>
                <h3 className="text-2xl mb-3">{program.name}</h3>
                <p className="text-kore-gray-dark/70 leading-relaxed mb-6">
                  {program.description}
                </p>
                <ul className="space-y-3">
                  {program.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-kore-red shrink-0" />
                      <span className="text-sm text-kore-gray-dark/80">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
