'use client';

import type { Trainer, Slot } from '@/lib/stores/bookingStore';

type Props = {
  trainer: Trainer | null;
  selectedSlot?: Slot | null;
  timezone?: string;
};

export default function TrainerInfoPanel({ trainer, selectedSlot, timezone }: Props) {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-4">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0">
          <span className="font-heading text-xl font-semibold text-kore-red">
            {trainer ? trainer.first_name.charAt(0) : 'K'}
          </span>
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">
            {trainer ? `${trainer.first_name} ${trainer.last_name}` : 'KÓRE'}
          </h2>
          {trainer?.specialty && (
            <p className="text-sm text-kore-gray-dark/50">{trainer.specialty}</p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3 pt-2">
        <p className="font-heading text-base font-semibold text-kore-gray-dark">
          Entrenamiento Kóre
        </p>

        <div className="flex items-center gap-2 text-sm text-kore-gray-dark/60">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{trainer?.session_duration_minutes ?? 60} min</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-kore-gray-dark/60">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span>En persona{trainer?.location ? ` — ${trainer.location}` : ''}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-kore-gray-dark/60">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <span>{tz}</span>
        </div>

        {/* Selected slot info */}
        {selectedSlot && (
          <div className="mt-4 p-3 bg-kore-cream rounded-xl">
            <p className="text-sm font-medium text-kore-gray-dark">
              {new Date(selectedSlot.starts_at).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-sm text-kore-gray-dark/60">
              {new Date(selectedSlot.starts_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' — '}
              {new Date(selectedSlot.ends_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
