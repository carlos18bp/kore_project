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
    <div className="sticky top-0 z-20 bg-kore-cream/95 backdrop-blur-sm -mx-4 px-4 py-2 border-b border-black/5">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onChange(tab.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'bg-kore-red text-white shadow-sm'
                  : 'bg-white/60 text-kore-gray-dark/50 border border-white/60 hover:bg-white/80'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
