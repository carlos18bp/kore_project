'use client';

import type { UpcomingSession } from '@/lib/stores/trainerStore';
import { addDays, dateKey, sessionsByDay } from '@/lib/utils/agendaDates';

type Props = {
  weekStart: Date; // lunes de la semana visible
  sessions: UpcomingSession[];
  blockedDates?: Set<string>;
  onSelectDay: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function AgendaWeekStrip({
  weekStart,
  sessions,
  blockedDates,
  onSelectDay,
  onPrev,
  onNext,
}: Props) {
  const byDay = sessionsByDay(sessions);
  const todayKey = dateKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rangeLabel = `${weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={onPrev}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-kore-wine-dark/55 hover:bg-kore-wine-dark/5 transition-colors"
        >
          ‹
        </button>
        <span className="font-body text-[12px] font-semibold text-kore-wine-dark capitalize">
          {rangeLabel}
        </span>
        <button
          type="button"
          aria-label="Semana siguiente"
          onClick={onNext}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-kore-wine-dark/55 hover:bg-kore-wine-dark/5 transition-colors"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const key = dateKey(day);
          const count = byDay.get(key)?.length ?? 0;
          const isToday = key === todayKey;
          const isBlocked = blockedDates?.has(key) ?? false;
          return (
            <button
              key={key}
              type="button"
              data-testid="week-day-cell"
              onClick={() => onSelectDay(day)}
              aria-label={isBlocked ? `${WEEKDAYS[i]} ${day.getDate()} (día bloqueado)` : undefined}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2 transition-colors ${
                isBlocked
                  ? 'border-kore-wine-dark/15 bg-kore-wine-dark/6'
                  : isToday
                    ? 'border-kore-crimson/40 bg-kore-crimson/8'
                    : 'border-kore-wine-dark/8 bg-kore-cream/50 hover:bg-white'
              }`}
            >
              <span className="font-body text-[9px] font-bold uppercase tracking-wide text-kore-wine-dark/45">
                {WEEKDAYS[i]}
              </span>
              <span
                className={`font-heading text-[15px] font-semibold ${
                  isBlocked ? 'text-kore-wine-dark/45 line-through decoration-[1.5px]' : 'text-kore-wine-dark'
                }`}
              >
                {day.getDate()}
              </span>
              {isBlocked ? (
                <span className="font-body text-[9px] font-bold uppercase tracking-wide text-kore-wine-dark/45">
                  Bloq.
                </span>
              ) : count > 0 ? (
                <span className="font-body text-[10px] font-bold text-kore-crimson">
                  {count}
                </span>
              ) : (
                <span className="font-body text-[10px] text-transparent">·</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
