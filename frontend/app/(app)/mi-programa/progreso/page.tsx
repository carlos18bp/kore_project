'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProgressStore } from '@/lib/stores/progressStore';
import WeeklyBarChart from '@/app/components/program/WeeklyBarChart';
import StreakBadge from '@/app/components/program/StreakBadge';

export default function ProgresoPage() {
  const { weeklySummary, weeklyLoading, fetchWeeklySummary } = useProgressStore();
  const [week, setWeek] = useState(1);

  useEffect(() => {
    fetchWeeklySummary();
  }, [fetchWeeklySummary]);

  useEffect(() => {
    if (weeklySummary) setWeek(weeklySummary.week_number);
  }, [weeklySummary]);

  function changeWeek(w: number) {
    setWeek(w);
    fetchWeeklySummary(w);
  }

  return (
    <main className="px-4 py-6 max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/mi-programa" className="text-kore-gray-dark/50 hover:text-kore-gray-dark">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-kore-gray-dark">Mi Progreso</h1>
      </div>

      {/* Week selector */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((w) => (
          <button
            key={w}
            onClick={() => changeWeek(w)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
              week === w
                ? 'bg-kore-red text-white'
                : 'bg-white/60 text-kore-gray-dark/50 border border-white/60 hover:bg-white/80'
            }`}
          >
            Sem. {w}
          </button>
        ))}
      </div>

      {weeklyLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
        </div>
      ) : weeklySummary ? (
        <>
          {/* Week average */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-kore-gray-dark">Semana {weeklySummary.week_number}</p>
              <span className="text-lg font-black text-kore-red">
                {Math.round(weeklySummary.week_average * 100)}%
              </span>
            </div>
            <div className="h-2 bg-kore-red/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-kore-red rounded-full transition-all duration-700"
                style={{ width: `${Math.round(weeklySummary.week_average * 100)}%` }}
              />
            </div>
            <p className="text-xs text-kore-gray-dark/40 mt-1.5">Adherencia combinada (60% entrenamiento + 40% nutrición)</p>
          </div>

          {/* Bar chart */}
          {weeklySummary.days.length > 0 && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
              <p className="text-xs font-semibold text-kore-gray-dark/60 mb-3 uppercase tracking-wide">Por día</p>
              <WeeklyBarChart days={weeklySummary.days} />
            </div>
          )}

          {/* Streak */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
            <p className="text-xs font-semibold text-kore-gray-dark/60 mb-3 uppercase tracking-wide">Racha</p>
            <StreakBadge
              current={weeklySummary.streak.current}
              longest={weeklySummary.streak.longest}
            />
            <p className="text-xs text-kore-gray-dark/40 mt-2">
              Un día cuenta si tu adherencia combinada ≥ 70%
            </p>
          </div>

          {/* Day breakdown */}
          {weeklySummary.days.length > 0 && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-kore-gray-dark/60 uppercase tracking-wide mb-3">Detalle por día</p>
              {weeklySummary.days.map((d) => {
                const label = new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' });
                const pct = Math.round(d.combined_adherence * 100);
                return (
                  <div key={d.date} className="flex items-center gap-3">
                    <p className="text-xs text-kore-gray-dark/60 w-28 capitalize shrink-0">{label}</p>
                    <div className="flex-1 h-1.5 bg-kore-red/10 rounded-full overflow-hidden">
                      <div className="h-full bg-kore-red rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-kore-gray-dark w-8 text-right shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-sm text-kore-gray-dark/50">No hay datos de progreso todavía.</p>
        </div>
      )}
    </main>
  );
}
