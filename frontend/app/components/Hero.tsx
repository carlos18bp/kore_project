'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { WHATSAPP_URL } from '@/lib/constants';

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  return (
    <section ref={sectionRef} className="relative min-h-[85vh] md:min-h-screen bg-kore-cream overflow-hidden flex items-center">
      {/* Subtle flower watermark behind content */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vmin] h-[80vmin] opacity-[0.03] pointer-events-none select-none">
        <Image
          src="/images/flower.webp"
          alt=""
          fill
          className="object-contain"
          aria-hidden="true"
        />
      </div>

      <div className="w-full px-5 md:px-10 lg:px-16 py-12 md:py-20 lg:py-0 flex flex-col lg:flex-row items-center gap-8 lg:gap-8">
        {/* Left Content */}
        <div className="flex-1 z-10 text-center lg:text-left">
          {/* Brand */}
          <span data-hero="badge" className="inline-block text-kore-gray-dark/40 text-xs md:text-sm font-medium tracking-[0.3em] uppercase mb-4 md:mb-8">
            KÓRE Health
          </span>

          {/* Main Slogan - "Vuelve al centro" */}
          <h1 data-hero="heading" className="font-heading text-5xl sm:text-6xl md:text-8xl lg:text-9xl tracking-tight mb-4 md:mb-8 leading-[0.9]">
            <span className="text-kore-gray-dark">Vuelve</span>
            <br />
            <span className="text-kore-wine-dark">al centro</span>
          </h1>

          {/* Subtitle */}
          <p data-hero="subtitle" className="text-base md:text-xl text-kore-gray-dark/60 leading-relaxed mb-4 md:mb-6 max-w-lg mx-auto lg:mx-0">
            Un proceso de movimiento consciente para habitar tu cuerpo con fuerza, seguridad y sentido.
          </p>

          {/* Microtexto */}
          <p data-hero="microtext" className="text-xs md:text-sm text-kore-gray-dark/50 mb-6 md:mb-10 max-w-md mx-auto lg:mx-0">
            Tu proceso no empieza con una rutina. Empieza con un diagnóstico real.
          </p>

          {/* CTA Buttons */}
          <div data-hero="cta" className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 mb-8 md:mb-14">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium px-6 py-3 md:px-8 md:py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
            >
              Agenda tu valoración gratis
            </a>
            <a
              href="/programs"
              className="inline-flex items-center justify-center border-2 border-kore-gray-dark/20 text-kore-gray-dark hover:border-kore-red hover:text-kore-red font-medium px-6 py-3 md:px-8 md:py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
            >
              Ver programas
            </a>
          </div>

        </div>

        {/* Right Image */}
        <div className="flex-1 flex justify-center lg:justify-end items-center">
          <div data-hero="image" className="relative w-[220px] h-[220px] sm:w-[300px] sm:h-[300px] md:w-[500px] md:h-[500px] lg:w-[600px] lg:h-[600px] xl:w-[700px] xl:h-[700px]">
            <Image
              src="/images/flower.webp"
              alt="Flor de Kóre - símbolo de armonía y vitalidad"
              fill
              sizes="(max-width: 640px) 320px, (max-width: 768px) 400px, (max-width: 1024px) 500px, 700px"
              className="object-contain"
              priority
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
