'use client';

import { useState } from 'react';
import type { Slot } from '@/lib/stores/bookingStore';

type Props = {
  slots: Slot[];
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
};

export default function TimeSlotPicker({ slots, selectedSlot, onSelectSlot }: Props) {
  const [use24h, setUse24h] = useState(true);

  function formatTime(isoString: string) {
    const d = new Date(isoString);
    if (use24h) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  if (slots.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-kore-gray-dark/40">
        No hay horarios disponibles para este día.
      </div>
    );
  }

  return (
    <div>
      {/* 12h / 24h toggle */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <button
          onClick={() => setUse24h(false)}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
            !use24h ? 'bg-kore-red text-white' : 'bg-kore-cream text-kore-gray-dark/60 hover:bg-kore-gray-light/40'
          }`}
        >
          12h
        </button>
        <button
          onClick={() => setUse24h(true)}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
            use24h ? 'bg-kore-red text-white' : 'bg-kore-cream text-kore-gray-dark/60 hover:bg-kore-gray-light/40'
          }`}
        >
          24h
        </button>
      </div>

      {/* Slot list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {slots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          return (
            <button
              key={slot.id}
              onClick={() => onSelectSlot(slot)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
                isSelected
                  ? 'border-kore-red bg-kore-red/10 text-kore-red'
                  : 'border-kore-gray-light/50 text-kore-gray-dark hover:border-kore-red/40 hover:bg-kore-red/5'
              }`}
            >
              {formatTime(slot.starts_at)} — {formatTime(slot.ends_at)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
