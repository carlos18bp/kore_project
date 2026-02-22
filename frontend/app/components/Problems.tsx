'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';

const problems = [
  {
    title: 'Rutinas genéricas',
    description: 'que no consideran tu historia, tu cuerpo ni tus objetivos reales',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  {
    title: 'Entrenar con dolor',
    description: 'por falta de corrección técnica, biomecánica y acompañamiento profesional',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    title: 'Falta de seguimiento',
    description: 'sin estructura clara ni evaluaciones que muestren tu progreso real',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
  },
  {
    title: 'Progresar sin saber',
    description: 'si realmente estás mejorando o simplemente repitiendo movimientos',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: 'Sentir que es obligación',
    description: 'y no un proceso consciente que conecta cuerpo, mente y salud',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function Problems() {
  const sectionRef = useRef<HTMLElement>(null);
  useTextReveal(sectionRef);

  return (
    <section ref={sectionRef} className="relative bg-white overflow-hidden">
      {/* Hero Image Section */}
      <div className="relative h-[70vh] md:h-[80vh]">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1623092350739-4635ce84d47c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcnVzdHJhdGVkJTIwd29ya291dCUyMGd5bSUyMHBhaW58ZW58MXx8fHwxNzcxNzkzNTA1fDA&ixlib=rb-4.1.0&q=80&w=1080" 
            alt="Training Problems" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70"></div>
        </div>

        <div className="relative h-full flex items-center">
          <div className="w-full px-6 md:px-10 lg:px-16">
            <p data-animate="fade-up" className="text-kore-red uppercase tracking-[0.25em] text-sm mb-6 font-medium">
              El problema
            </p>
            <h2 data-animate="split-text" data-delay="0.1" className="text-6xl md:text-7xl lg:text-8xl font-heading font-semibold text-white mb-6 leading-[0.95] max-w-4xl">
              Lo que normalmente falla
            </h2>
            <p data-animate="fade-up" data-delay="0.2" className="text-xl md:text-2xl text-kore-cream/90 max-w-2xl leading-relaxed">
              Entrenar sin método no es solo ineficaz. Es frustrante, insostenible y peligroso.
            </p>
          </div>
        </div>
      </div>

      {/* Problems List */}
      <div className="w-full px-6 md:px-10 lg:px-16 py-20 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-12">
          {problems.map((problem, index) => (
            <div
              key={index}
              data-animate="fade-up"
              data-delay={`${index * 0.1}`}
              className="group"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-kore-rose/10 flex items-center justify-center group-hover:bg-kore-rose transition-colors duration-300">
                    <div className="text-kore-rose group-hover:text-white transition-colors duration-300">
                      {problem.icon}
                    </div>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-2xl font-heading font-semibold text-kore-wine-dark mb-3">
                    {problem.title}
                  </h3>
                  <p className="text-lg text-kore-gray-dark/70 leading-relaxed">
                    {problem.description}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* CTAs - Right Column */}
          <div data-animate="fade-up" data-delay="0.6" className="flex flex-col gap-4">
            <a
              href="#valoracion"
              className="inline-flex items-center justify-center bg-kore-red hover:bg-kore-red-dark text-white font-medium px-8 py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
            >
              Quiero empezar bien
            </a>
            <a
              href="/kore-brand"
              className="inline-flex items-center justify-center border-2 border-kore-gray-dark/20 text-kore-gray-dark hover:border-kore-red hover:text-kore-red font-medium px-8 py-4 rounded-lg transition-colors duration-200 text-sm tracking-wide"
            >
              Conocer el método
            </a>
          </div>
        </div>
      </div>

      {/* Solution Section */}
      <div className="bg-kore-wine-dark relative overflow-hidden">
        {/* Watermark decorations */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px]">
            <Image
              src="/images/flower.webp"
              alt=""
              fill
              className="object-contain"
            />
          </div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px]">
            <Image
              src="/images/spiral.webp"
              alt=""
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="w-full px-6 md:px-10 lg:px-16 py-24 lg:py-32 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div data-animate="fade-right" className="relative h-[400px] lg:h-[500px] rounded-3xl overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1591259354202-d1e6123e7b66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5kZnVsJTIwbW92ZW1lbnQlMjB5b2dhJTIwZmxvd3xlbnwxfHx8fDE3NzE3OTM1MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080" 
                alt="KÓRE Movement" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-kore-wine-dark/60 to-transparent"></div>
            </div>

            <div data-animate="fade-left">
              <span className="inline-block text-white text-sm font-medium tracking-widest uppercase mb-8">
                La solución KÓRE
              </span>

              <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-semibold mb-6 leading-tight" style={{color: 'white'}}>
                Devolvemos sentido al movimiento
              </h3>

              <p className="text-xl md:text-2xl text-kore-cream/95 mb-10 leading-relaxed">
                No entrenamos para cumplir.
                <br />
                Entrenamos para <span className="text-kore-red-light font-semibold">transformar</span>.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="/kore-brand"
                  className="inline-flex items-center justify-center bg-white text-kore-wine-dark px-8 py-4 rounded-xl font-semibold text-lg hover:bg-kore-cream transition-all duration-300 shadow-xl"
                >
                  Conocer el método
                </a>
                <a
                  href="#valoracion"
                  className="inline-flex items-center justify-center bg-transparent text-white px-8 py-4 rounded-xl font-semibold text-lg border-2 border-white/30 hover:border-white hover:bg-white/10 transition-all duration-300"
                >
                  Agendar diagnóstico
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
