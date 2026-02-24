'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';

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
                href="#programs"
                className="inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium px-6 py-3 md:px-8 md:py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
              >
                Ver programas
              </a>
              <a
                href="https://wa.me/573238122373"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center border-2 border-kore-gray-dark/20 text-kore-gray-dark hover:border-kore-red hover:text-kore-red font-medium px-6 py-3 md:px-8 md:py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 448 512" fill="currentColor">
                  <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157m-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1s56.2 81.2 56.1 130.5c0 101.8-84.9 184.6-186.6 184.6m101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8s-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7s-12.5-30.1-17.1-41.2c-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2s-9.7 1.4-14.8 6.9c-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4s4.6-24.1 3.2-26.4c-1.3-2.5-5-3.9-10.5-6.6"/>
                </svg>
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
