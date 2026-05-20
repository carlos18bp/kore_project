'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import type { UpcomingSession } from '@/lib/stores/trainerStore';
import { addDays, dateKey, startOfWeek, sessionsByDay } from '@/lib/utils/agendaDates';
import AgendaWeekStrip from './AgendaWeekStrip';
import AgendaMonthGrid from './AgendaMonthGrid';
import AgendaDayModal from './AgendaDayModal';

type View = 'dia' | 'semana' | 'mes';

const VIEW_LABEL: Record<View, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes' };

function fmtTime24(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/** Timeline por hora de un día — la vista "Día". */
function DayTimeline({ sessions }: { sessions: UpcomingSession[] }) {
  const hours = Array.from({ length: 15 }, (_, i) => 7 + i);
  const byHour = useMemo(() => {
    const map: Record<number, UpcomingSession[]> = {};
    sessions.forEach((s) => {
      if (!s.starts_at) return;
      const h = new Date(s.starts_at).getHours();
      (map[h] ??= []).push(s);
    });
    return map;
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="font-body text-[13px] text-kore-wine-dark/55">
          Sin sesiones programadas hoy.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 400 }}>
      {hours.map((h) => {
        const slots = byHour[h] ?? [];
        if (slots.length === 0) return null;
        return (
          <div key={h} className="grid" style={{ gridTemplateColumns: '48px 1fr', minHeight: 40 }}>
            <div className="flex items-start justify-end pr-3.5 pt-2.5">
              <span className="font-body text-[11px] font-semibold text-kore-wine-dark/40">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
            <div className="border-l pb-3 pl-4" style={{ borderColor: 'rgba(103,15,34,0.12)' }}>
              <div className="flex flex-col gap-2 pt-1">
                {slots.map((s) => (
                  <Link
                    key={s.id}
                    href={`/trainer/clients/client?id=${s.customer_id}`}
                    prefetch={false}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] border border-kore-wine-dark/8 bg-white/65 transition-colors hover:bg-white"
                  >
                    <span className="font-heading text-sm font-semibold text-kore-wine-dark w-11 flex-shrink-0">
                      {s.starts_at ? fmtTime24(s.starts_at) : '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-[13px] font-semibold text-kore-gray-dark truncate">
                        {s.customer_name}
                      </p>
                      <p className="font-body text-[11px] text-kore-wine-dark/55 truncate">
                        {s.package_title}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AgendaCard() {
  const { agendaSessions, fetchAgendaSessions } = useTrainerStore();
  const [view, setView] = useState<View>('dia');
  // refDate: día de referencia para semana/mes. Para "día" siempre es hoy.
  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Rango a pedir según la vista activa.
  const range = useMemo(() => {
    if (view === 'dia') {
      const today = new Date();
      return { from: dateKey(today), to: dateKey(today) };
    }
    if (view === 'semana') {
      const ws = startOfWeek(refDate);
      return { from: dateKey(ws), to: dateKey(addDays(ws, 6)) };
    }
    const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const last = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    return { from: dateKey(first), to: dateKey(last) };
  }, [view, refDate]);

  useEffect(() => {
    fetchAgendaSessions(range.from, range.to);
  }, [range.from, range.to, fetchAgendaSessions]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDay) return [];
    return sessionsByDay(agendaSessions).get(dateKey(selectedDay)) ?? [];
  }, [selectedDay, agendaSessions]);

  return (
    <div
      className="bg-white/65 rounded-[22px] overflow-hidden"
      style={{ border: '1px solid rgba(103,15,34,0.08)', boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)' }}
    >
      <div
        className="flex items-center justify-between gap-4 px-6 py-5 flex-wrap"
        style={{ borderBottom: '1px solid rgba(103,15,34,0.08)' }}
      >
        <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase text-kore-wine-dark/55">
          Agenda
        </p>
        <div className="flex gap-1 p-1 rounded-xl bg-kore-wine-dark/6">
          {(['dia', 'semana', 'mes'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg font-body text-[11px] font-semibold transition-all ${
                view === v
                  ? 'bg-white text-kore-wine-dark shadow-sm'
                  : 'text-kore-wine-dark/55 hover:text-kore-wine-dark'
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      {view === 'dia' && <DayTimeline sessions={agendaSessions} />}
      {view === 'semana' && (
        <AgendaWeekStrip
          weekStart={startOfWeek(refDate)}
          sessions={agendaSessions}
          onSelectDay={setSelectedDay}
          onPrev={() => setRefDate((d) => addDays(startOfWeek(d), -7))}
          onNext={() => setRefDate((d) => addDays(startOfWeek(d), 7))}
        />
      )}
      {view === 'mes' && (
        <AgendaMonthGrid
          monthRef={refDate}
          sessions={agendaSessions}
          onSelectDay={setSelectedDay}
          onPrev={() => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          onNext={() => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        />
      )}

      {selectedDay && (
        <AgendaDayModal
          date={selectedDay}
          sessions={selectedDaySessions}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
