'use client';

import type { UpcomingSession } from '@/lib/stores/trainerStore';
import { dateKey, sessionsByDay } from '@/lib/utils/agendaDates';

type Props = {
  monthRef: Date; // cualquier fecha dentro del mes visible
  sessions: UpcomingSession[];
  blockedDates?: Set<string>;
  onSelectDay: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
};

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function AgendaMonthGrid({
  monthRef,
  sessions,
  blockedDates,
  onSelectDay,
  onPrev,
  onNext,
}: Props) {
  const year = monthRef.getFullYear();
  const month = monthRef.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // 0 = lunes
  const byDay = sessionsByDay(sessions);
  const todayKey = dateKey(new Date());
  const monthLabel = firstDay.toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={onPrev}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-kore-wine-dark/55 hover:bg-kore-wine-dark/5 transition-colors"
        >
          ‹
        </button>
        <span className="font-body text-[12px] font-semibold text-kore-wine-dark capitalize">
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={onNext}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-kore-wine-dark/55 hover:bg-kore-wine-dark/5 transition-colors"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={`h-${i}`}
            className="text-center font-body text-[9px] font-bold uppercase text-kore-wine-dark/40 pb-1"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const day = new Date(year, month, dayNum);
          const key = dateKey(day);
          const count = byDay.get(key)?.length ?? 0;
          const isToday = key === todayKey;
          const isBlocked = blockedDates?.has(key) ?? false;
          return (
            <button
              key={key}
              type="button"
              data-testid={`month-day-${dayNum}`}
              onClick={() => onSelectDay(day)}
              aria-label={isBlocked ? `${dayNum} (día bloqueado)` : `${dayNum}`}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors ${
                isBlocked
                  ? 'bg-kore-wine-dark/8 text-kore-wine-dark/45'
                  : isToday
                    ? 'bg-kore-crimson/10 text-kore-crimson font-bold'
                    : 'text-kore-wine-dark hover:bg-kore-wine-dark/5'
              }`}
            >
              <span
                className={`font-body text-[12px] font-semibold ${
                  isBlocked ? 'line-through decoration-[1.5px]' : ''
                }`}
              >
                {dayNum}
              </span>
              {count > 0 && !isBlocked && (
                <span
                  data-testid="month-day-dot"
                  className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-kore-crimson"
                />
              )}
              {isBlocked && (
                <span
                  data-testid="month-day-blocked"
                  className="absolute bottom-1 right-1 text-[8px] text-kore-wine-dark/55"
                >
                  ⊘
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
