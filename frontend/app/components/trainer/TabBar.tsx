'use client';

import { useState, useRef, useEffect } from 'react';

type Tab = {
  id: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
};

export default function TabBar({ tabs, activeTab, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? '';

  // Cerrar el dropdown al hacer click fuera.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      {/* Móvil/tablet — dropdown: muestra el tab activo, despliega los 9 */}
      <div data-testid="tabbar-dropdown" ref={dropdownRef} className="relative xl:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-xl border border-kore-wine-dark/12 bg-white/70 px-4 py-3 font-body text-[12px] font-bold uppercase tracking-[0.10em] text-kore-wine-dark"
        >
          {activeLabel}
          <svg
            className={`w-4 h-4 text-kore-wine-dark/55 transition-transform duration-150 ${
              open ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-kore-wine-dark/12 bg-white shadow-[0_12px_32px_-12px_rgba(45,15,26,0.35)]">
            {tabs.map((tab) => {
              const sel = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => select(tab.id)}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left font-body text-[12px] transition-colors duration-100 ${
                    sel
                      ? 'bg-kore-wine-dark/6 font-bold text-kore-wine-dark'
                      : 'font-medium text-kore-wine-dark/65 hover:bg-kore-wine-dark/4'
                  }`}
                >
                  <span className={`w-3.5 text-kore-wine-dark ${sel ? '' : 'opacity-0'}`}>✓</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop — rail vertical */}
      <nav data-testid="tabbar-rail" className="hidden xl:flex xl:flex-col xl:gap-0.5">
        {tabs.map((tab) => {
          const sel = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`border-l-2 rounded-r-lg px-3.5 py-2.5 text-left font-body text-[12px] tracking-[0.04em] transition-all duration-100 ${
                sel
                  ? 'border-kore-wine-dark bg-kore-wine-dark/6 text-kore-wine-dark font-bold'
                  : 'border-transparent text-kore-wine-dark/55 hover:bg-kore-wine-dark/4 font-medium'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
