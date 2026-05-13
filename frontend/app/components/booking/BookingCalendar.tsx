'use client';

import { useState, useMemo } from 'react';

type Props = {
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

export default function BookingCalendar({ availableDates, selectedDate, onSelectDate }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  });

  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  function dateStr(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${viewYear}-${m}-${d}`;
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-kore-cream transition-colors"
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
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-kore-cream transition-colors"
          aria-label="Mes siguiente"
        >
          <svg className="w-5 h-5 text-kore-gray-dark/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-kore-gray-dark/40 py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const ds = dateStr(day);
          const isPast = ds < todayStr;
          const hasSlots = availableDates.has(ds);
          const isSelected = ds === selectedDate;

          return (
            <button
              key={day}
              disabled={isPast || !hasSlots}
              onClick={() => onSelectDate(ds)}
              className={`
                relative w-full aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150
                ${isSelected
                  ? 'bg-kore-red text-white'
                  : hasSlots && !isPast
                    ? 'text-kore-gray-dark hover:bg-kore-red/10 hover:text-kore-red cursor-pointer'
                    : 'text-kore-gray-dark/20 cursor-not-allowed'
                }
              `}
            >
              {day}
              {hasSlots && !isPast && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-kore-red" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
