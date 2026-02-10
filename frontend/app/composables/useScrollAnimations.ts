'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useTextReveal(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const elements = containerRef.current!.querySelectorAll('[data-animate]');

      elements.forEach((el) => {
        const type = el.getAttribute('data-animate');
        const delay = parseFloat(el.getAttribute('data-delay') || '0');

        gsap.set(el, { opacity: 0, y: 30 });

        const config: gsap.TweenVars = {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        };

        switch (type) {
          case 'fade-up':
            break;
          case 'fade-up-slow':
            config.duration = 1.2;
            config.y = 50;
            break;
          case 'fade-left':
            gsap.set(el, { opacity: 0, x: -40, y: 0 });
            config.y = 0;
            config.x = 0;
            break;
          case 'fade-right':
            gsap.set(el, { opacity: 0, x: 40, y: 0 });
            config.y = 0;
            config.x = 0;
            break;
          case 'scale-in':
            gsap.set(el, { opacity: 0, scale: 0.9, y: 0 });
            config.y = 0;
            config.scale = 1;
            break;
          case 'split-text':
            config.duration = 1;
            config.y = 40;
            config.ease = 'power4.out';
            break;
          case 'stagger-children':
            gsap.set(el, { opacity: 1, y: 0 });
            const children = el.children;
            gsap.set(children, { opacity: 0, y: 25 });
            gsap.to(children, {
              opacity: 1,
              y: 0,
              duration: 0.6,
              stagger: 0.1,
              delay,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 80%',
                toggleActions: 'play none none none',
              },
            });
            return;
        }

        gsap.to(el, config);
      });
    }, containerRef);

    return () => ctx.revert();
  }, [containerRef]);
}

export function useHeroAnimation(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('[data-hero="badge"]', { opacity: 0, y: 20, duration: 0.6, delay: 0.2 })
        .from('[data-hero="heading"]', { opacity: 0, y: 40, duration: 0.8 }, '-=0.3')
        .from('[data-hero="subtitle"]', { opacity: 0, y: 30, duration: 0.7 }, '-=0.4')
        .from('[data-hero="body"]', { opacity: 0, y: 25, duration: 0.7 }, '-=0.4')
        .from('[data-hero="cta"]', { opacity: 0, y: 20, duration: 0.6 }, '-=0.3')
        .from('[data-hero="stats"]', { opacity: 0, y: 20, duration: 0.6 }, '-=0.3')
        .from('[data-hero="image"]', { opacity: 0, scale: 0.85, duration: 1.2, ease: 'power2.out' }, '-=0.8');
    }, containerRef);

    return () => ctx.revert();
  }, [containerRef]);
}
