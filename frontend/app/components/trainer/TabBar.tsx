'use client';

import { useRef, useEffect } from 'react';

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
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab]);

  return (
    <>
      {/* Móvil/tablet — strip horizontal con scroll */}
      <div
        data-testid="tabbar-strip"
        className="xl:hidden relative border-b border-kore-wine-dark/10"
      >
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const sel = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                ref={sel ? activeRef : undefined}
                onClick={() => onChange(tab.id)}
                className={`flex-shrink-0 -mb-px border-b-2 px-[18px] py-3.5 font-body text-[11px] uppercase tracking-[0.10em] whitespace-nowrap transition-all duration-100 ${
                  sel
                    ? 'border-kore-wine-dark text-kore-wine-dark font-bold'
                    : 'border-transparent text-kore-wine-dark/55 font-medium'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
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
