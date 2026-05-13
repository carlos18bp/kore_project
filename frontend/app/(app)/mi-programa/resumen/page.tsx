'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useProgressStore } from '@/lib/stores/progressStore';
import ComparisonCard from '@/app/components/program/ComparisonCard';
import StreakBadge from '@/app/components/program/StreakBadge';

export default function ResumenMensualPage() {
  const { monthlySummary, monthlyLoading, fetchMonthlySummary } = useProgressStore();

  useEffect(() => {
    fetchMonthlySummary();
  }, [fetchMonthlySummary]);

  const formatDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <main className="px-4 py-6 max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/mi-programa" className="text-kore-gray-dark/50 hover:text-kore-gray-dark">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-kore-gray-dark">Resumen Mensual</h1>
      </div>

      {monthlyLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
        </div>
      ) : monthlySummary ? (
        <>
          {/* Program dates */}
          <p className="text-xs text-kore-gray-dark/40 text-center capitalize">
            {formatDate(monthlySummary.start_date)} — {formatDate(monthlySummary.end_date)}
          </p>

          {/* Adherence overview */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-kore-gray-dark/60 uppercase tracking-wide">Adherencia total</p>
            {[
              { label: 'Combinada', value: monthlySummary.overall_adherence, color: 'bg-kore-red' },
              { label: 'Entrenamiento', value: monthlySummary.training_adherence, color: 'bg-kore-red/70' },
              { label: 'Nutrición', value: monthlySummary.nutrition_adherence, color: 'bg-teal-400' },
            ].map(({ label, value, color }) => {
              const pct = Math.round(value * 100);
              return (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-kore-gray-dark/60">{label}</span>
                    <span className="text-xs font-bold text-kore-gray-dark">{pct}%</span>
                  </div>
                  <div className="h-2 bg-kore-red/10 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison cards */}
          <div>
            <p className="text-xs font-semibold text-kore-gray-dark/60 uppercase tracking-wide mb-2">Evolución</p>
            <div className="grid grid-cols-1 gap-3">
              <ComparisonCard
                label="Índice de masa corporal (IMC)"
                before={monthlySummary.comparisons.bmi.before}
                after={monthlySummary.comparisons.bmi.after}
                delta={monthlySummary.comparisons.bmi.delta}
                lowerIsBetter
                decimals={2}
              />
              <ComparisonCard
                label="Grasa corporal"
                before={monthlySummary.comparisons.body_fat_pct.before}
                after={monthlySummary.comparisons.body_fat_pct.after}
                delta={monthlySummary.comparisons.body_fat_pct.delta}
                unit="%"
                lowerIsBetter
              />
              <ComparisonCard
                label="Condición física"
                before={monthlySummary.comparisons.physical_index.before}
                after={monthlySummary.comparisons.physical_index.after}
                delta={monthlySummary.comparisons.physical_index.delta}
                decimals={2}
              />
              {(monthlySummary.weight.start !== null || monthlySummary.weight.end !== null) && (
                <ComparisonCard
                  label="Peso"
                  before={monthlySummary.weight.start}
                  after={monthlySummary.weight.end}
                  delta={monthlySummary.weight.delta}
                  unit=" kg"
                  lowerIsBetter
                  decimals={1}
                />
              )}
            </div>
          </div>

          {/* Mood */}
          {(monthlySummary.mood.first_week !== null || monthlySummary.mood.last_week !== null) && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
              <p className="text-xs font-semibold text-kore-gray-dark/60 uppercase tracking-wide mb-3">Bienestar</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 text-center">
                  <p className="text-2xl font-black text-kore-gray-dark">{monthlySummary.mood.first_week ?? '—'}</p>
                  <p className="text-xs text-kore-gray-dark/40 mt-0.5">1ª semana</p>
                </div>
                <svg className="w-6 h-4 text-kore-gray-dark/20 flex-shrink-0" fill="none" viewBox="0 0 24 16">
                  <path d="M0 8h20m0 0l-5-4m5 4l-5 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex-1 text-center">
                  <p className={`text-2xl font-black ${monthlySummary.mood.last_week !== null && monthlySummary.mood.first_week !== null && monthlySummary.mood.last_week > monthlySummary.mood.first_week ? 'text-teal-600' : monthlySummary.mood.last_week !== null && monthlySummary.mood.first_week !== null && monthlySummary.mood.last_week < monthlySummary.mood.first_week ? 'text-rose-500' : 'text-kore-gray-dark'}`}>
                    {monthlySummary.mood.last_week ?? '—'}
                  </p>
                  <p className="text-xs text-kore-gray-dark/40 mt-0.5">Última semana</p>
                </div>
              </div>
              <p className="text-xs text-kore-gray-dark/40 text-center mt-2">Promedio de 1 a 10</p>
            </div>
          )}

          {/* Best streak */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
            <p className="text-xs font-semibold text-kore-gray-dark/60 uppercase tracking-wide mb-3">Mejor racha</p>
            <StreakBadge current={0} longest={monthlySummary.streak_best} />
            <p className="text-xs text-kore-gray-dark/40 mt-2">Un día cuenta si tu adherencia combinada ≥ 70%</p>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-sm text-kore-gray-dark/50">No hay datos de resumen todavía.</p>
          <p className="text-xs text-kore-gray-dark/30 mt-2">Disponible cuando tengas un programa activo o completado.</p>
        </div>
      )}
    </main>
  );
}
