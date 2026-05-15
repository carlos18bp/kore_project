'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const LETTERS = ['K', 'Ó', 'R', 'E'] as const;

interface AppSplashProps {
  /**
   * Fires once the entrance animation (letters + underline) has played in full.
   * The ambient breath continues afterwards while the splash stays mounted.
   */
  onEntranceComplete?: () => void;
}

export default function AppSplash({ onEntranceComplete }: AppSplashProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onEntranceCompleteRef = useRef(onEntranceComplete);
  onEntranceCompleteRef.current = onEntranceComplete;

  useEffect(() => {
    if (!containerRef.current) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      gsap.set('.kore-splash-letter', {
        opacity: 0,
        y: 24,
        filter: 'blur(10px)',
      });
      gsap.set('.kore-splash-line', {
        scaleX: 0,
        transformOrigin: 'left center',
      });

      if (reduceMotion) {
        gsap.set('.kore-splash-letter', { opacity: 1, y: 0, filter: 'blur(0px)' });
        gsap.set('.kore-splash-line', { scaleX: 1 });
        onEntranceCompleteRef.current?.();
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.to('.kore-splash-letter', {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.85,
        stagger: 0.1,
      });

      tl.to(
        '.kore-splash-line',
        { scaleX: 1, duration: 0.9, ease: 'power2.inOut' },
        '-=0.7',
      );

      tl.call(() => {
        onEntranceCompleteRef.current?.();
      });

      tl.to(
        '.kore-splash-word',
        {
          scale: 1.02,
          opacity: 0.85,
          duration: 1.8,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          transformOrigin: 'center center',
        },
        '+=0.15',
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      aria-label="Cargando"
      className="fixed inset-0 z-50 flex items-center justify-center bg-kore-cream"
    >
      <div className="flex flex-col items-center gap-5" aria-hidden="true">
        <div className="kore-splash-word flex items-baseline">
          {LETTERS.map((char, i) => (
            <span
              key={i}
              className="kore-splash-letter inline-block font-heading text-6xl md:text-7xl font-semibold text-kore-wine-dark tracking-[0.35em] last:mr-[-0.35em] will-change-transform"
            >
              {char}
            </span>
          ))}
        </div>
        <span className="kore-splash-line block h-px w-16 bg-kore-wine-dark/30" />
      </div>
    </div>
  );
}
