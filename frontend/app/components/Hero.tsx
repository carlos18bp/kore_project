'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  return (
    <section ref={sectionRef} className="relative min-h-screen bg-kore-cream overflow-hidden flex items-center">
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

      <div className="w-full px-6 md:px-10 lg:px-16 py-20 lg:py-0 flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
        {/* Left Content */}
        <div className="flex-1 z-10 text-center lg:text-left">
          {/* Brand */}
          <span data-hero="badge" className="inline-block text-kore-gray-dark/40 text-sm font-medium tracking-[0.3em] uppercase mb-8">
            KÓRE Health
          </span>

          {/* Main Slogan - "Vuelve al centro" */}
          <h1 data-hero="heading" className="font-heading text-6xl sm:text-7xl md:text-8xl lg:text-9xl tracking-tight mb-8 leading-[0.9]">
            <span className="text-kore-gray-dark">Vuelve</span>
            <br />
            <span className="text-kore-wine-dark">al centro</span>
          </h1>

          {/* Subtitle */}
          <p data-hero="subtitle" className="text-lg md:text-xl text-kore-gray-dark/60 leading-relaxed mb-10 max-w-md mx-auto lg:mx-0">
            Movimiento consciente. Salud real.
            <br className="hidden sm:block" />
            <span className="text-kore-gray-dark/80 font-medium">Acompañamiento 1 a 1.</span>
          </p>

          {/* CTA Buttons */}
          <div data-hero="cta" className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 mb-14">
            <a
              href="#programs"
              className="inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium px-8 py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
            >
              Ver programas
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center border-2 border-kore-gray-dark/20 text-kore-gray-dark hover:border-kore-red hover:text-kore-red font-medium px-8 py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
            >
              Iniciar sesión
            </a>
          </div>

          {/* Stats */}
          <div data-hero="stats" className="flex justify-center lg:justify-start gap-10 lg:gap-14">
            <div className="text-center lg:text-left">
              <p className="font-heading text-2xl md:text-3xl font-semibold text-kore-wine-dark">
                100%
              </p>
              <p className="text-xs text-kore-gray-dark/50 mt-1 tracking-wide">
                Personalizado
              </p>
            </div>
            <div className="text-center lg:text-left">
              <p className="font-heading text-2xl md:text-3xl font-semibold text-kore-wine-dark">
                1 a 1
              </p>
              <p className="text-xs text-kore-gray-dark/50 mt-1 tracking-wide">
                Acompañamiento
              </p>
            </div>
            <div className="text-center lg:text-left">
              <p className="font-heading text-2xl md:text-3xl font-semibold text-kore-wine-dark">
                360°
              </p>
              <p className="text-xs text-kore-gray-dark/50 mt-1 tracking-wide">
                Evaluación
              </p>
            </div>
          </div>
        </div>

        {/* Right Image */}
        <div className="flex-1 flex justify-center lg:justify-end items-center">
          <div data-hero="image" className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] md:w-[500px] md:h-[500px] lg:w-[600px] lg:h-[600px] xl:w-[700px] xl:h-[700px]">
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
