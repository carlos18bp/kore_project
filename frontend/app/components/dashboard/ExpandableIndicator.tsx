'use client';

import { useState, useRef, useCallback } from 'react';
import gsap from 'gsap';

const CT: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', orange: 'text-orange-700', red: 'text-red-600' };
const CB: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', orange: 'bg-orange-100', red: 'bg-red-100' };
const CD: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500' };

export type IndicatorData = {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  category: string;
  color: string;
  whatIs: string;
  meaning: string;
  importance: string;
  nextStep: string;
  formula?: string;
};

export function ExpandableIndicator({ ind }: { ind: IndicatorData }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const col = ind.color || 'green';

  const toggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!contentRef.current) return;
    const el = contentRef.current;
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      gsap.set(el, { height: 0, opacity: 0, display: 'block', overflow: 'hidden' });
      gsap.to(el, { height: 'auto', opacity: 1, duration: 0.35, ease: 'power3.out' });
      if (arrowRef.current) gsap.to(arrowRef.current, { rotation: 180, duration: 0.25, ease: 'power2.inOut' });
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => { gsap.set(el, { display: 'none' }); } });
      if (arrowRef.current) gsap.to(arrowRef.current, { rotation: 0, duration: 0.25, ease: 'power2.inOut' });
    }
  }, [open]);

  return (
    <div className="rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 py-1.5 cursor-pointer hover:bg-kore-cream/30 rounded-lg transition-colors text-left"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${CD[col] || CD.green}`} />
        <span className="text-xs text-kore-gray-dark/70 flex-1">{ind.label}</span>
        <span className={`text-xs font-medium ${CT[col] || CT.green}`}>{ind.category}</span>
        <svg ref={arrowRef} className="w-3 h-3 text-kore-gray-dark/25 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div ref={contentRef} style={{ display: 'none', height: 0 }}>
        <div className="pl-4 pr-1 pb-3 pt-1 space-y-2">
          {/* Result + Classification */}
          <div className={`rounded-lg p-2.5 ${CB[col] || CB.green}`}>
            <div className="flex items-baseline justify-between mb-1">
              <p className={`text-xs font-medium ${CT[col] || CT.green}`}>Tu resultado</p>
              <span className={`font-heading text-sm font-bold ${CT[col] || CT.green}`}>{ind.value}{ind.unit ? <span className="text-xs font-normal ml-0.5">{ind.unit}</span> : null}</span>
            </div>
            <p className={`text-xs ${CT[col] || CT.green} font-medium`}>{ind.category}</p>
          </div>
          {/* What it is */}
          <div className="bg-kore-cream/40 rounded-lg p-2.5">
            <p className="text-xs text-kore-gray-dark/45 uppercase tracking-wider font-medium mb-0.5">Qué es</p>
            <p className="text-xs text-kore-gray-dark/70 leading-relaxed">{ind.whatIs}</p>
          </div>
          {/* Meaning */}
          <div className="bg-white/60 rounded-lg p-2.5 border border-kore-gray-light/20">
            <p className="text-xs text-kore-gray-dark/45 uppercase tracking-wider font-medium mb-0.5">Qué significa para ti</p>
            <p className="text-xs text-kore-gray-dark/70 leading-relaxed">{ind.meaning}</p>
          </div>
          {/* Importance */}
          <div className="bg-white/60 rounded-lg p-2.5 border border-kore-gray-light/20">
            <p className="text-xs text-kore-gray-dark/45 uppercase tracking-wider font-medium mb-0.5">Importancia en tu proceso</p>
            <p className="text-xs text-kore-gray-dark/70 leading-relaxed">{ind.importance}</p>
          </div>
          {/* Next step */}
          <div className="bg-kore-red/5 rounded-lg p-2.5 border border-kore-red/10">
            <p className="text-xs text-kore-red/60 uppercase tracking-wider font-medium mb-0.5">Qué sigue con tu entrenador</p>
            <p className="text-xs text-kore-gray-dark/70 leading-relaxed">{ind.nextStep}</p>
          </div>
          {/* Formula (optional) */}
          {ind.formula && (
            <div className="bg-kore-cream/20 rounded-lg p-2.5 border border-kore-gray-light/15">
              <p className="text-xs text-kore-gray-dark/35 uppercase tracking-wider font-medium mb-0.5">Cómo se calcula</p>
              <p className="text-xs text-kore-gray-dark/50 leading-relaxed">{ind.formula}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
