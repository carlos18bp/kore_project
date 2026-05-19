'use client';

import { useState, useMemo } from 'react';
import type { ClientSession } from '@/lib/stores/trainerStore';

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Props = {
  sessions: ClientSession[];        // sessions to display (assume upcoming/pending)
  selectedSessionId: number | null;
  onSelectSession: (id: number) => void;
};

export default function SessionMiniCalendar({ sessions, selectedSessionId, onSelectSession }: Props) {
  // Default reference month = month of the first selected/upcoming session (or today)
  const initialRef = useMemo(() => {
    const sel = sessions.find(s => s.id === selectedSessionId);
    if (sel?.starts_at) return new Date(sel.starts_at);
    if (sessions[0]?.starts_at) return new Date(sessions[0].starts_at);
    return new Date();
  }, [sessions, selectedSessionId]);

  const [ref, setRef] = useState<Date>(new Date(initialRef.getFullYear(), initialRef.getMonth(), 1));

  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const todayKey = toDateKey(new Date());
  const monthLabel = firstDay.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  // Map dateKey -> session (we take the first session of that day if many)
  const sessionByDay = useMemo(() => {
    const map = new Map<string, ClientSession>();
    for (const s of sessions) {
      if (!s.starts_at) continue;
      const key = toDateKey(new Date(s.starts_at));
      if (!map.has(key)) map.set(key, s);
    }
    return map;
  }, [sessions]);

  const selected = sessions.find(s => s.id === selectedSessionId) ?? null;
  const selectedKey = selected?.starts_at ? toDateKey(new Date(selected.starts_at)) : null;

  function changeMonth(delta: number) {
    setRef(new Date(year, month + delta, 1));
  }

  return (
    <div className="bg-white/70 rounded-2xl border border-kore-gray-light/40 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Mes anterior"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-kore-gray-dark/[0.04] transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 text-kore-gray-dark/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/55 capitalize">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Mes siguiente"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-kore-gray-dark/[0.04] transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 text-kore-gray-dark/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-[3px]">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-[9px] text-kore-gray-dark/35 font-semibold uppercase pb-0.5">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const session = sessionByDay.get(dateStr);
          const hasSession = !!session;
          const hasObjective = !!(session?.session_objective);
          const isSelected = selectedKey === dateStr;
          const isToday = dateStr === todayKey;

          const baseClass = 'relative aspect-square rounded-md flex items-center justify-center transition-colors';
          let stateClass: string;
          if (isSelected) {
            stateClass = 'bg-kore-wine-dark text-white ring-2 ring-kore-wine-dark/50';
          } else if (hasSession) {
            stateClass = 'bg-kore-red/10 hover:bg-kore-red/20 cursor-pointer';
          } else {
            stateClass = 'bg-kore-gray-dark/[0.02] text-kore-gray-dark/30';
          }

          const dayTextClass = isSelected
            ? 'text-white font-semibold'
            : hasSession
              ? 'text-kore-wine-dark font-semibold'
              : isToday
                ? 'text-kore-red font-semibold'
                : 'text-kore-gray-dark/35';

          return (
            <button
              key={day}
              type="button"
              onClick={() => session && onSelectSession(session.id)}
              disabled={!hasSession}
              className={`${baseClass} ${stateClass}`}
              title={hasSession ? `${day} · ${session?.package_title}${hasObjective ? ' · ✓ nota' : ''}` : `${day}`}
            >
              <span className={`text-[10px] tabular-nums ${dayTextClass}`}>{day}</span>
              {hasObjective && (
                <span
                  className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ring-2 ring-white ${isSelected ? 'bg-white ring-kore-wine-dark' : 'bg-kore-red'}`}
                  aria-label="con nota"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-kore-gray-dark/55 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-kore-red/10" />
          Día con sesión
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-kore-wine-dark" />
          Seleccionada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-kore-red" />
          Nota guardada
        </div>
      </div>
    </div>
  );
}
