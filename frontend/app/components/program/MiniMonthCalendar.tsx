'use client';

import { Check } from 'lucide-react';
import type { DayAdherence } from '@/lib/stores/progressStore';

interface BookingLike {
  status: string;
  slot: { starts_at: string };
}

interface Props {
  weekDays: DayAdherence[];
  bookings: BookingLike[];
  // Reference date to pick which month to show. Defaults to today.
  referenceDate?: Date;
  className?: string;
}

const COMPLETION_THRESHOLD = 0.70;

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function MiniMonthCalendar({ weekDays, bookings, referenceDate, className = '' }: Props) {
  const ref = referenceDate ?? new Date();
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Convert JS Sun=0 to Mon=0 layout.
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const completedSet = new Set(
    weekDays.filter((d) => d.combined_adherence >= COMPLETION_THRESHOLD).map((d) => d.date),
  );
  const bookingSet = new Set(
    bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'pending')
      .map((b) => toDateKey(new Date(b.slot.starts_at))),
  );
  const todayKey = toDateKey(new Date());
  const monthLabel = firstDay.toLocaleDateString('es-CO', { month: 'long' });

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-kore-gray-dark/45 capitalize">
          {monthLabel}
        </p>
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-[8.5px] text-kore-gray-dark/35 font-semibold uppercase pb-0.5">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayKey;
          const isPast = dateStr < todayKey;
          const isCompleted = completedSet.has(dateStr);
          const hasBooking = bookingSet.has(dateStr);

          return (
            <div
              key={day}
              className={`relative aspect-square rounded-md flex items-center justify-center transition-colors ${
                isCompleted
                  ? 'bg-emerald-50'
                  : isToday
                  ? 'bg-kore-red/[0.06]'
                  : 'bg-kore-gray-dark/[0.025]'
              } ${isToday ? 'ring-1 ring-kore-red/60' : ''}`}
              title={isCompleted ? `${day} · completado` : hasBooking ? `${day} · sesión agendada` : `${day}`}
            >
              {isCompleted ? (
                <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={3} />
              ) : (
                <span className={`text-[8.5px] tabular-nums font-medium ${
                  isToday ? 'text-kore-red font-semibold' : isPast ? 'text-kore-gray-dark/35' : 'text-kore-gray-dark/55'
                }`}>
                  {day}
                </span>
              )}
              {hasBooking && (
                <span className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-kore-red" aria-label="sesión agendada" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-[9px] text-kore-gray-dark/45 font-medium">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-50 flex items-center justify-center">
            <Check className="w-1.5 h-1.5 text-emerald-600" strokeWidth={3} />
          </span>
          Completo
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-kore-red" />
          Sesión
        </div>
      </div>
    </div>
  );
}
