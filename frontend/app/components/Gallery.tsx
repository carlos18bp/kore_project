'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTextReveal } from '@/app/composables/useScrollAnimations';
import MobileSwiper from '@/app/components/MobileSwiper';

const images = [
  { src: '/images/pose/pose-05.webp', alt: 'Estudio anatómico - espalda' },
  { src: '/images/pose/pose-06.webp', alt: 'Estudio anatómico - perfil' },
  { src: '/images/pose/pose-07.webp', alt: 'Estudio anatómico - fuerza' },
  { src: '/images/pose/pose-10.webp', alt: 'Estudio anatómico - torso' },
  { src: '/images/pose/pose-11.webp', alt: 'Estudio anatómico - brazos' },
  { src: '/images/pose/pose-13.webp', alt: 'Estudio anatómico - postura' },
  { src: '/images/flower.webp', alt: 'Flor de Kóre - armonía y vitalidad' },
  { src: '/images/hands.webp', alt: 'Manos abiertas - acompañamiento' },
  { src: '/images/pose.webp', alt: 'Silueta en movimiento' },
  { src: '/images/spiral.webp', alt: 'Espiral - origen del movimiento' },
];

export default function Gallery() {
  const sectionRef = useRef<HTMLElement>(null);
  useTextReveal(sectionRef);

  return (
    <section ref={sectionRef} className="bg-kore-cream py-10 lg:py-12 overflow-hidden">
      <div className="w-full px-5 md:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <span data-animate="fade-up" className="inline-block text-kore-red text-xs md:text-sm font-medium tracking-widest uppercase mb-3 md:mb-6">
            Estilo visual
          </span>
          <h2 data-animate="split-text" data-delay="0.1" className="text-xl sm:text-2xl md:text-4xl lg:text-5xl mb-6 md:mb-8 leading-tight">
            El cuerpo como arte y ciencia
          </h2>
          <p data-animate="fade-up" data-delay="0.2" className="text-sm md:text-lg text-kore-gray-dark/70 leading-relaxed">
            Las ilustraciones anatómicas son un elemento distintivo de KÓRE.
            Representan el conocimiento técnico y la atención al detalle que
            caracterizan cada sesión.
          </p>
        </div>

        {/* Swiper on mobile */}
        <MobileSwiper slidesPerView={1.4} spaceBetween={10} autoplayDelay={3000}>
          {images.slice(0, 6).map((img, index) => (
            <div key={index} className="relative rounded-2xl overflow-hidden">
              <Image
                src={img.src}
                alt={img.alt}
                width={400}
                height={500}
                className="w-full h-[280px] object-cover"
              />
            </div>
          ))}
        </MobileSwiper>

        {/* Pinterest-style Masonry - md+ only */}
        <div data-animate="fade-up" data-delay="0.3" className="hidden md:block columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {images.map((img, index) => (
            <div
              key={index}
              className="relative break-inside-avoid rounded-2xl overflow-hidden group"
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={600}
                height={800}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-kore-wine-dark/0 group-hover:bg-kore-wine-dark/20 transition-colors duration-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
