'use client';

import { useState } from 'react';
import type { ProgramDay, MonthlyProgram } from '@/lib/stores/programStore';

type Props = {
  program: MonthlyProgram;
  selectedDateStr?: string;
  onSelectDay: (day: ProgramDay | null, dateStr: string) => void;
};

const TODAY = new Date().toISOString().slice(0, 10);

function firstWeekdayMon(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function toDateStr(y: number, m: number, day: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthsInRange(start: string, end: string): { year: number; month: number }[] {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const months: { year: number; month: number }[] = [];
  let y = s.getFullYear(), m = s.getMonth();
  while (y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth())) {
    months.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return months;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TYPE_DOT: Record<ProgramDay['day_type'], string> = {
  training: 'bg-kore-red',
  active_rest: 'bg-teal-500',
  rest: 'bg-kore-gray-light',
};

export default function ProgramCalendar({ program, selectedDateStr, onSelectDay }: Props) {
  const months = getMonthsInRange(program.start_date, program.end_date);

  const initialIdx = Math.max(0, months.findIndex(
    ({ year, month }) => year === new Date().getFullYear() && month === new Date().getMonth(),
  ));
  const [activeMonth, setActiveMonth] = useState(initialIdx < 0 ? 0 : initialIdx);

  const dayMap = new Map(program.days.map((d) => [d.date, d]));
  const bookingSet = new Set(program.booking_dates ?? []);

  const { year, month } = months[activeMonth];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: firstWeekdayMon(year, month) }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthLabel = new Date(year, month).toLocaleDateString('es-CO', {
    month: 'long', year: 'numeric',
  });

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={() => setActiveMonth((i) => Math.max(0, i - 1))}
          disabled={activeMonth === 0}
          className="p-2 rounded-lg hover:bg-kore-cream transition-colors disabled:opacity-25"
          aria-label="Mes anterior"
        >
          <svg className="w-5 h-5 text-kore-gray-dark/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h3 className="font-heading text-base font-semibold text-kore-gray-dark capitalize">
          {monthLabel}
        </h3>
        <button
          onClick={() => setActiveMonth((i) => Math.min(months.length - 1, i + 1))}
          disabled={activeMonth === months.length - 1}
          className="p-2 rounded-lg hover:bg-kore-cream transition-colors disabled:opacity-25"
          aria-label="Mes siguiente"
        >
          <svg className="w-5 h-5 text-kore-gray-dark/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-1 px-3 mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-kore-gray-dark/40 py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 px-3 pb-4">
        {blanks.map((i) => <div key={`b-${i}`} />)}
        {days.map((dayNum) => {
          const dateStr = toDateStr(year, month, dayNum);
          const programDay = dayMap.get(dateStr);
          const hasBooking = bookingSet.has(dateStr);
          const isToday = dateStr === TODAY;
          const isPast = dateStr < TODAY;
          const isSelected = dateStr === selectedDateStr;
          const inProgram = !!programDay;

          if (!inProgram && !hasBooking) {
            return (
              <div key={dateStr} className={`relative w-full aspect-square flex items-center justify-center rounded-lg text-sm font-medium ${isPast ? 'text-kore-gray-dark/15' : 'text-kore-gray-dark/25'}`}>
                {dayNum}
              </div>
            );
          }

          const dotColor = programDay ? TYPE_DOT[programDay.day_type] : 'bg-kore-gray-light';

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDay(programDay ?? null, dateStr)}
              className={`
                relative w-full aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150
                ${isToday
                  ? 'bg-kore-red text-white shadow-sm'
                  : isSelected
                    ? 'bg-kore-red/15 text-kore-red ring-1 ring-kore-red/40'
                    : isPast
                      ? 'text-kore-gray-dark/40 hover:bg-kore-cream'
                      : 'text-kore-gray-dark hover:bg-kore-red/10 hover:text-kore-red'
                }
              `}
            >
              {dayNum}
              {!isToday && !isSelected && inProgram && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${dotColor} ${isPast ? 'opacity-40' : ''}`} />
              )}
              {hasBooking && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-blue-500 ring-1 ring-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-kore-gray-light/30">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-kore-red" />
          <span className="text-[10px] text-kore-gray-dark/50">Entreno</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <span className="text-[10px] text-kore-gray-dark/50">Activo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-kore-gray-light border border-kore-gray-dark/20" />
          <span className="text-[10px] text-kore-gray-dark/50">Descanso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[10px] text-kore-gray-dark/50">Sesión</span>
        </div>
      </div>
    </div>
  );
}
