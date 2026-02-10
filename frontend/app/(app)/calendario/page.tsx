'use client';

import { useRef, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

declare global {
  interface Window {
    Cal?: ((...args: unknown[]) => void) & {
      ns?: Record<string, ((...args: unknown[]) => void) & { q?: unknown[] }>;
      q?: unknown[];
      loaded?: boolean;
    };
  }
}

export default function CalendarioPage() {
  const { user } = useAuthStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    // Load Cal.com embed script
    (function (C: Window, A: string, L: string) {
      const p = function (a: { q: unknown[] }, ar: unknown) { a.q.push(ar); };
      const d = C.document;
      C.Cal = C.Cal || function (...args: unknown[]) {
        const cal = C.Cal!;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          const script = d.createElement('script');
          script.src = A;
          d.head.appendChild(script);
          cal.loaded = true;
        }
        if (args[0] === L) {
          const api = function (...apiArgs: unknown[]) { p(api as unknown as { q: unknown[] }, apiArgs); } as unknown as ((...a: unknown[]) => void) & { q: unknown[] };
          const namespace = args[1] as string;
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns![namespace] = cal.ns![namespace] || api;
            p(cal.ns![namespace] as unknown as { q: unknown[] }, args);
            p(cal as unknown as { q: unknown[] }, ['initNamespace', namespace]);
          } else {
            p(cal as unknown as { q: unknown[] }, args);
          }
          return;
        }
        p(cal as unknown as { q: unknown[] }, args);
      } as Window['Cal'];
    })(window, 'https://app.cal.com/embed/embed.js', 'init');

    window.Cal!('init', '30min', { origin: 'https://app.cal.com' });

    window.Cal!.ns!['30min']!('inline', {
      elementOrSelector: '#my-cal-inline-30min',
      config: { layout: 'week_view', theme: 'light' },
      calLink: 'german-eduardo-franco-moreno-2vifn7/30min',
    });

    window.Cal!.ns!['30min']!('ui', {
      theme: 'light',
      cssVarsPerTheme: { light: { 'cal-brand': '#E00000' } },
      hideEventTypeDetails: false,
      layout: 'month_view',
    });
  }, []);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-8 pb-16">
        {/* Top bar */}
        <div data-hero="badge" className="mb-8">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Calendario</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Agenda tu sesión
          </h1>
        </div>

        {/* Cal.com Embed */}
        <div data-hero="heading" className="bg-white/60 backdrop-blur-sm rounded-2xl border border-kore-gray-light/50 overflow-hidden">
          <div
            id="my-cal-inline-30min"
            style={{ width: '100%', height: 'calc(100vh - 160px)', overflow: 'auto' }}
          />
        </div>
      </div>
    </section>
  );
}
