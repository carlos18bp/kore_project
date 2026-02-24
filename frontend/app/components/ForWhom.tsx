'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';
import { WHATSAPP_URL } from '@/lib/constants';

const checkItems = [
  'Quieres empezar a entrenar pero hacerlo bien desde el inicio',
  'Tienes dolor o molestias y necesitas una guía segura',
  'Dejaste de entrenar y quieres retomar con confianza',
  'Buscas mejorar postura, movilidad y control corporal',
  'Quieres un proceso consciente, no solo exigencia',
  'Quieres sentirte fuerte, estable y seguro en tu cuerpo',
];

export default function ForWhom() {
  const sectionRef = useRef<HTMLElement>(null);
  useTextReveal(sectionRef);

  return (
    <section ref={sectionRef} className="bg-kore-cream py-10 lg:py-20 overflow-hidden">
      <div className="w-full px-5 md:px-10 lg:px-16">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-24 items-center">
          {/* Left - Content */}
          <div className="flex-1 order-2 lg:order-1">
            <span data-animate="fade-up" className="inline-block text-kore-red text-xs md:text-sm font-medium tracking-widest uppercase mb-3 md:mb-8">
              Para quién es
            </span>
            <h2 data-animate="split-text" data-delay="0.1" className="text-xl sm:text-2xl md:text-4xl lg:text-5xl mb-8 md:mb-10 leading-tight">
              Si buscas algo más que solo entrenar, este espacio es para ti.
            </h2>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6 mb-8 md:mb-12">
              {checkItems.map((item, index) => (
                <li
                  key={index}
                  data-animate="fade-up"
                  data-delay={`${0.2 + index * 0.1}`}
                  className="flex items-start gap-3"
                >
                  <span className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-kore-red/10 flex items-center justify-center mt-0.5">
                    <svg
                      className="w-3 h-3 md:w-4 md:h-4 text-kore-red"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm md:text-base text-kore-gray-dark/80 leading-snug md:leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            <div data-animate="fade-up" data-delay="0.8" className="flex flex-col sm:flex-row gap-3">
              <a
                href="/programs"
                className="inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium px-6 py-3 md:px-8 md:py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
              >
                Ver programas
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center border-2 border-kore-gray-dark/20 text-kore-gray-dark hover:border-kore-red hover:text-kore-red font-medium px-6 py-3 md:px-8 md:py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
              >
                Escríbenos
              </a>
            </div>
          </div>

          {/* Right - Image (hidden on small mobile, shown from sm+) */}
          <div data-animate="fade-right" className="hidden sm:block flex-shrink-0 order-1 lg:order-2">
            <div className="relative w-[260px] h-[340px] sm:w-[280px] sm:h-[380px] lg:w-[420px] lg:h-[560px] rounded-3xl overflow-hidden">
              <Image
                src="/images/pose/pose-04.webp"
                alt="Entrenamiento consciente KÓRE"
                fill
                sizes="(max-width: 640px) 260px, (max-width: 1024px) 280px, 420px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
