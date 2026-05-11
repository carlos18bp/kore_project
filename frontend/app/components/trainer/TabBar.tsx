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
    <div style={{ position: 'relative', borderBottom: '1px solid rgba(103,15,34,0.10)', marginBottom: 0 }}>
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map(tab => {
          const sel = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={sel ? activeRef : undefined}
              onClick={() => onChange(tab.id)}
              style={{
                padding: '14px 18px',
                border: 'none',
                background: 'transparent',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 11,
                fontWeight: sel ? 700 : 500,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: sel ? '#670F22' : 'rgba(103,15,34,0.55)',
                borderBottom: sel ? '2px solid #670F22' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 120ms',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
