'use client';

import { useEffect, useRef, useState } from 'react';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import type { RiskLevel } from '@/lib/stores/trainerStore';
import AlertCard from '@/app/components/trainer/AlertCard';
import HeroOrbsCard from '@/app/components/shared/HeroOrbsCard';
import SectionLabel from '@/app/components/shared/SectionLabel';
import EmptyState from '@/app/components/shared/EmptyState';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

type FilterLevel = 'all' | RiskLevel;

const FILTERS: { id: FilterLevel; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'alto', label: 'Alto' },
  { id: 'medio', label: 'Medio' },
  { id: 'bajo', label: 'Bajo' },
  { id: 'sin_riesgo', label: 'Sin riesgo' },
];

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function TrainerAlertsPage() {
  const { alerts, alertsLoading, fetchAlerts, resolveAlert } = useTrainerStore();
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveSheet, setResolveSheet] = useState<{ id: number; customerName: string } | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveType, setResolveType] = useState<'private_note' | 'public_note' | 'schedule_eval' | 'mark_reviewed'>('mark_reviewed');
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filtered = filter === 'all'
    ? alerts
    : alerts.filter((a) => a.level === filter);

  const activeCount = alerts.filter((a) => a.level === 'alto' || a.level === 'medio').length;
  const resolvedToday = alerts.reduce((acc, a) => {
    return acc + a.resolutions.filter((r) => isToday(r.resolved_at)).length;
  }, 0);

  const handleOpenResolve = (id: number) => {
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;
    setResolveNote('');
    setResolveType('mark_reviewed');
    setResolveSheet({ id, customerName: alert.customer_name });
  };

  const handleSubmitResolve = async () => {
    if (!resolveSheet) return;
    setResolvingId(resolveSheet.id);
    try {
      await resolveAlert(resolveSheet.id, { signal_type: 'general', resolution_type: resolveType, note: resolveNote, is_public: resolveType === 'public_note' });
      setResolveSheet(null);
      await fetchAlerts();
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto space-y-5">

        {/* Header */}
        <div data-hero="badge">
          <SectionLabel className="mb-0.5">Inteligencia</SectionLabel>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark">Centro de Alertas</h1>
        </div>

        {/* Hero KPI */}
        <HeroOrbsCard radius="2xl">
          <div data-hero="heading" className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.18em] mb-1">
                  Alertas activas
                </p>
                <p className="text-5xl font-black tracking-tight text-white leading-none">
                  {activeCount}
                </p>
                <p className="text-white/50 text-xs mt-2 leading-relaxed">
                  Clientes en riesgo alto o medio que requieren tu atención.
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.18em] mb-1">
                  Resueltas hoy
                </p>
                <p className="text-3xl font-black tracking-tight text-white leading-none tabular-nums">
                  {resolvedToday}
                </p>
              </div>
            </div>
          </div>
        </HeroOrbsCard>

        {/* Filter chips */}
        <div data-hero="body" className="space-y-2">
          <SectionLabel>Filtrar por nivel</SectionLabel>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 active:scale-95 ${
                  filter === f.id
                    ? 'bg-kore-gray-dark text-white shadow-sm'
                    : 'bg-white/70 backdrop-blur-sm border border-kore-gray-light/40 text-kore-gray-dark/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Alert list */}
        {alertsLoading && alerts.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-7 w-7 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? 'No hay alertas activas' : `Sin alertas de nivel "${FILTERS.find(f => f.id === filter)?.label}"`}
            description="Cuando un cliente cruce un umbral conductual o clínico, su alerta aparecerá aquí."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onResolve={handleOpenResolve}
              />
            ))}
          </div>
        )}
      </div>

      {/* Resolve Sheet */}
      {resolveSheet && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={() => setResolveSheet(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-kore-gray-light rounded-full" />
            </div>
            <div className="px-4 pt-2 pb-8 space-y-4">
              <div>
                <SectionLabel className="mb-1">Resolver alerta</SectionLabel>
                <p className="text-base font-semibold text-kore-gray-dark">{resolveSheet.customerName}</p>
              </div>

              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {([
                  { id: 'mark_reviewed', label: 'Revisado' },
                  { id: 'private_note', label: 'Nota privada' },
                  { id: 'public_note', label: 'Nota pública' },
                  { id: 'schedule_eval', label: 'Agendar eval' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setResolveType(opt.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                      resolveType === opt.id
                        ? 'bg-kore-gray-dark text-white'
                        : 'bg-kore-cream text-kore-gray-dark/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {resolveType !== 'mark_reviewed' && (
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  rows={3}
                  placeholder={resolveType === 'schedule_eval' ? 'Qué evaluación y cuándo...' : 'Escribe una nota...'}
                  className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 resize-none focus:outline-none focus:ring-2 focus:ring-kore-red/30"
                />
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setResolveSheet(null)}
                  className="flex-1 py-3 rounded-xl bg-kore-cream text-kore-gray-dark/60 text-sm font-medium active:scale-95 transition-transform duration-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitResolve}
                  disabled={resolvingId !== null}
                  className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-medium active:scale-95 transition-transform duration-100 disabled:opacity-60"
                >
                  {resolvingId !== null ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
