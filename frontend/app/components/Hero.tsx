'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  return (
    <section ref={sectionRef} className="relative min-h-screen bg-kore-cream overflow-hidden">
      <div className="w-full px-6 md:px-10 lg:px-16 pb-16 flex flex-col lg:flex-row items-center gap-8 lg:gap-4">
        {/* Left Content */}
        <div className="flex-1 z-10">
          {/* Badge */}
          <span data-hero="badge" className="inline-block bg-kore-cream border border-kore-gray-light rounded-full px-4 py-1.5 text-sm font-medium text-kore-gray-dark mb-6">
            Salud desde el centro
          </span>

          {/* Main Heading */}
          <h1 data-hero="heading" className="text-5xl md:text-6xl lg:text-7xl tracking-tight mb-6">
            <span className="text-kore-gray-dark">KÓRE</span>{' '}
            <span className="text-kore-gray-dark">Health</span>
          </h1>

          {/* Subtitle */}
          <p data-hero="subtitle" className="font-heading text-xl md:text-2xl lg:text-3xl text-kore-burgundy font-semibold leading-snug mb-6">
            Del origen, al núcleo, al movimiento consciente
          </p>

          {/* Body Text */}
          <p data-hero="body" className="text-base md:text-lg text-kore-gray-dark/80 leading-relaxed mb-10 max-w-lg">
            No entrenamos cuerpos aislados.{" "}
            <strong className="text-kore-gray-dark font-medium">
              Acompañamos personas completas
            </strong>
            . Donde cada sesión construye salud real: moverse mejor, vivir
            mejor, habitar el cuerpo con conciencia.
          </p>

          {/* CTA Buttons */}
          <div data-hero="cta" className="flex flex-wrap gap-4 mb-14">
            <a
              href="#programs"
              className="inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium px-8 py-3.5 rounded-lg transition-colors duration-200"
            >
              Ver programas
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center border-2 border-kore-red text-kore-red hover:bg-kore-red hover:text-white font-medium px-8 py-3.5 rounded-lg transition-colors duration-200"
            >
              Iniciar sesión
            </a>
          </div>

          {/* Stats */}
          <div data-hero="stats" className="flex gap-12 lg:gap-16">
            <div>
              <p className="font-heading text-3xl md:text-4xl font-semibold text-kore-wine-dark">
                100%
              </p>
              <p className="text-sm text-kore-gray-dark/70 mt-1">
                Personalizado
              </p>
            </div>
            <div>
              <p className="font-heading text-3xl md:text-4xl font-semibold text-kore-wine-dark">
                1 a 1
              </p>
              <p className="text-sm text-kore-gray-dark/70 mt-1">
                Acompañamiento
              </p>
            </div>
            <div>
              <p className="font-heading text-3xl md:text-4xl font-semibold text-kore-wine-dark">
                360°
              </p>
              <p className="text-sm text-kore-gray-dark/70 mt-1">
                Evaluación
              </p>
            </div>
          </div>
        </div>

        {/* Right Image */}
        <div className="flex-1 flex justify-center lg:justify-end items-center">
          <div data-hero="image" className="relative w-[480px] h-[480px] md:w-[700px] md:h-[700px] lg:w-[950px] lg:h-[950px] xl:w-[1100px] xl:h-[1100px]">
            <Image
              src="/images/flower.webp"
              alt="Flor de Kóre - símbolo de armonía y vitalidad"
              fill
              sizes="(max-width: 768px) 480px, (max-width: 1280px) 700px, 1100px"
              className="object-contain opacity-90"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
