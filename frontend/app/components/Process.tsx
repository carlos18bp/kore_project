'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';

const steps = [
  {
    number: '01',
    title: 'Primer contacto',
    description:
      'Nos escribes por la web o WhatsApp. Conversamos sobre ti, tus objetivos y lo que necesitas.',
  },
  {
    number: '02',
    title: 'Diagnóstico inicial',
    description:
      'Anamnesis completa, historial médico, hábitos de vida e identificación de patologías o restricciones.',
  },
  {
    number: '03',
    title: 'Evaluación completa',
    description:
      'Evaluación postural, análisis fotográfico, capacidad aeróbica y anaeróbica, movilidad articular y funcional.',
  },
  {
    number: '04',
    title: 'Tu programa',
    description:
      'Definición de objetivos reales y progresivos. Asignación del programa más adecuado para ti.',
  },
  {
    number: '05',
    title: 'Sesiones guiadas',
    description:
      'Cada sesión se adapta a tu evolución. Corrección postural, control motor y explicación clara de cada ejercicio.',
  },
  {
    number: '06',
    title: 'Seguimiento continuo',
    description:
      'Revisiones cada 3 meses: antropometría, posturometría, actualización de historial y reajuste de objetivos.',
  },
];

export default function Process() {
  const sectionRef = useRef<HTMLElement>(null);
  useTextReveal(sectionRef);

  return (
    <section ref={sectionRef} className="bg-kore-cream py-10 lg:py-12">
      <div className="w-full px-6 md:px-10 lg:px-16">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-20 items-center">
          {/* Left - Image */}
          <div data-animate="fade-left" className="flex-shrink-0">
            <div className="relative w-[300px] h-[400px] lg:w-[400px] lg:h-[540px] rounded-3xl overflow-hidden">
              <Image
                src="/images/pose/pose-08.webp"
                alt="Proceso KÓRE - estudio anatómico"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Right - Steps */}
          <div className="flex-1">
            <span data-animate="fade-up" className="inline-block text-kore-red text-sm font-medium tracking-widest uppercase mb-4">
              Cómo funciona
            </span>
            <h2 data-animate="split-text" data-delay="0.1" className="text-3xl md:text-4xl lg:text-5xl mb-12">
              El proceso KÓRE
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
              {steps.map((step) => (
                <div key={step.number} data-animate="fade-right" data-delay={`${parseInt(step.number) * 0.1}`} className="relative pl-16">
                  <span className="absolute left-0 top-0 font-heading text-4xl font-semibold text-kore-red/20">
                    {step.number}
                  </span>
                  <h3 className="text-lg font-heading font-semibold text-kore-wine-dark mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-kore-gray-dark/70 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
