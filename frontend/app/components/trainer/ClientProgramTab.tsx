'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import type { MonthlyProgram, ProgramDay } from '@/lib/stores/programStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import SectionLabel from '@/app/components/shared/SectionLabel';
import EmptyState from '@/app/components/shared/EmptyState';
import AdherenceRing from './AdherenceRing';

const LEVEL_LABEL: Record<number, string> = {
  1: 'Fundacional', 2: 'Básico', 3: 'Intermedio', 4: 'Avanzado', 5: 'Elite',
};

const GOAL_LABEL: Record<string, string> = {
  fat_loss: 'Pérdida de grasa',
  muscle_gain: 'Ganancia muscular',
  rehab: 'Rehabilitación',
  general_health: 'Salud general',
  sports_performance: 'Rendimiento deportivo',
};

const DAY_TYPE_LABEL: Record<string, string> = {
  training: 'Entrenamiento',
  active_rest: 'Recuperación activa',
  rest: 'Descanso',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  published: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  completed: 'Completado',
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type SubView = 'plan' | 'adherence';

type Props = {
  clientId: number;
};

export default function ClientProgramTab({ clientId }: Props) {
  const {
    clientDailyLogs,
    dailyLogsLoading,
    fetchClientDailyLogs,
  } = useTrainerStore();

  const [subView, setSubView] = useState<SubView>('plan');
  const [programs, setPrograms] = useState<MonthlyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [trainerNotes, setTrainerNotes] = useState('');
  const [error, setError] = useState('');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));

  const activeProgram = programs[0] ?? null;
  const dailyLogs = clientDailyLogs[clientId] ?? [];

  useEffect(() => {
    if (!clientId) return;
    fetchPrograms();
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (subView === 'adherence' && !clientDailyLogs[clientId]) {
      fetchClientDailyLogs(clientId, 14);
    }
  }, [subView, clientId, clientDailyLogs, fetchClientDailyLogs]);

  useEffect(() => {
    if (activeProgram) setTrainerNotes(activeProgram.trainer_notes ?? '');
  }, [activeProgram?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<MonthlyProgram[]>(`/monthly-programs/customer/${clientId}/`, {
        headers: authHeaders(),
      });
      setPrograms(data);
    } catch {
      setError('No se pudieron cargar los programas.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      await api.post('/monthly-programs/generate/', { customer_id: clientId }, {
        headers: authHeaders(),
      });
      await fetchPrograms();
    } catch {
      setError('No se pudo generar el programa. Verifica que el cliente tenga el rol correcto.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!activeProgram) return;
    setApproving(true);
    setError('');
    try {
      await api.patch(
        `/monthly-programs/${activeProgram.id}/approve/`,
        { trainer_notes: trainerNotes },
        { headers: authHeaders() },
      );
      await fetchPrograms();
    } catch {
      setError('No se pudo publicar el programa.');
    } finally {
      setApproving(false);
    }
  };

  const toggleWeek = (week: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  };

  const weeks: ProgramDay[][] = activeProgram
    ? [1, 2, 3, 4].map((w) =>
        activeProgram.days.filter((d) => Math.ceil(d.day_number / 7) === w)
      )
    : [];

  return (
    <div className="space-y-4">
      {/* Sub-toggle */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
        <div className="flex">
          <button
            onClick={() => setSubView('plan')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              subView === 'plan'
                ? 'text-kore-red border-b-2 border-kore-red'
                : 'text-kore-gray-dark/50 hover:text-kore-gray-dark border-b-2 border-transparent'
            }`}
          >
            Plan mensual
          </button>
          <button
            onClick={() => setSubView('adherence')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              subView === 'adherence'
                ? 'text-kore-red border-b-2 border-kore-red'
                : 'text-kore-gray-dark/50 hover:text-kore-gray-dark border-b-2 border-transparent'
            }`}
          >
            Adherencia 14d
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {subView === 'plan' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin h-7 w-7 border-2 border-kore-red border-t-transparent rounded-full" />
            </div>
          ) : !activeProgram ? (
            <EmptyState
              title="Sin programa publicado"
              description="Genera el primer plan mensual para este cliente. Tomará unos segundos."
              cta={{
                label: generating ? 'Generando…' : 'Generar programa',
                onClick: handleGenerate,
              }}
            />
          ) : (
            <>
              {/* Program header card */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[activeProgram.status]}`}>
                        {STATUS_LABEL[activeProgram.status]}
                      </span>
                      <span className="text-xs text-kore-gray-dark/40">
                        Nivel {activeProgram.fitness_level} · {LEVEL_LABEL[activeProgram.fitness_level]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-kore-gray-dark">
                      {GOAL_LABEL[activeProgram.goal] ?? activeProgram.goal}
                    </p>
                    <p className="text-xs text-kore-gray-dark/40 mt-0.5">
                      {activeProgram.start_date} → {activeProgram.end_date}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {activeProgram.status === 'draft' && (
                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {approving ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                        Publicar
                      </button>
                    )}
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="flex items-center justify-center gap-2 bg-kore-red/10 text-kore-red text-xs font-semibold px-3 py-2 rounded-xl hover:bg-kore-red/15 disabled:opacity-50 transition-colors"
                    >
                      {generating ? 'Generando…' : 'Regenerar'}
                    </button>
                  </div>
                </div>

                {activeProgram.status === 'draft' && (
                  <div className="mt-4 pt-4 border-t border-kore-gray-light/30">
                    <SectionLabel className="mb-1.5">Nota para el cliente (opcional)</SectionLabel>
                    <textarea
                      value={trainerNotes}
                      onChange={(e) => setTrainerNotes(e.target.value)}
                      placeholder="Indica objetivos, consideraciones especiales..."
                      rows={3}
                      className="w-full text-sm text-kore-gray-dark bg-kore-cream/50 border border-kore-gray-light/40 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kore-red/30 resize-none"
                    />
                  </div>
                )}
                {activeProgram.status !== 'draft' && activeProgram.trainer_notes && (
                  <div className="mt-3 pt-3 border-t border-kore-gray-light/30">
                    <SectionLabel className="mb-1">Nota del entrenador</SectionLabel>
                    <p className="text-sm text-kore-gray-dark/70">{activeProgram.trainer_notes}</p>
                  </div>
                )}
              </div>

              {/* Weeks */}
              {weeks.map((weekDays, idx) => {
                const weekNum = idx + 1;
                const isExpanded = expandedWeeks.has(weekNum);
                const trainDays = weekDays.filter((d) => d.day_type === 'training').length;
                return (
                  <div key={weekNum} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleWeek(weekNum)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-kore-cream/30 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-kore-gray-dark text-sm">Semana {weekNum}</p>
                        <p className="text-xs text-kore-gray-dark/40 mt-0.5">
                          {trainDays} días de entrenamiento
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-kore-gray-dark/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {weekDays.map((day) => {
                          const isTraining = day.day_type === 'training';
                          const isActiveRest = day.day_type === 'active_rest';
                          return (
                            <div key={day.id} className="rounded-xl border border-kore-gray-light/30 overflow-hidden">
                              <div
                                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${
                                  isTraining
                                    ? 'bg-kore-red/5 text-kore-red'
                                    : isActiveRest
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-gray-50 text-kore-gray-dark/40'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                  isTraining ? 'bg-kore-red/15' : isActiveRest ? 'bg-blue-100' : 'bg-gray-200'
                                }`}>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    {isTraining ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    ) : isActiveRest ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    ) : (
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                                    )}
                                  </svg>
                                </span>
                                <span>Día {day.day_number} · {day.date}</span>
                                <span className="ml-auto font-normal">{DAY_TYPE_LABEL[day.day_type]}</span>
                              </div>
                              {day.exercises.length > 0 && (
                                <div className="divide-y divide-kore-gray-light/20">
                                  {day.exercises.map((pe) => (
                                    <div key={pe.id} className="flex items-start gap-3 px-3 py-2.5">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-kore-gray-dark">{pe.exercise.name}</p>
                                        <p className="text-[10px] text-kore-gray-dark/40 mt-0.5">
                                          {pe.sets} series ·{' '}
                                          {pe.reps
                                            ? `${pe.reps} reps`
                                            : pe.duration_seconds
                                            ? `${pe.duration_seconds}s`
                                            : '—'}{' '}
                                          · {pe.rest_seconds}s descanso
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                                        {pe.exercise.pattern && (
                                          <span className="text-[9px] bg-kore-gray-light/40 text-kore-gray-dark/50 px-1.5 py-0.5 rounded-full">
                                            {pe.exercise.pattern}
                                          </span>
                                        )}
                                        {pe.exercise.youtube_url && (
                                          <a
                                            href={pe.exercise.youtube_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-kore-red hover:text-kore-red/70"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                            </svg>
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {subView === 'adherence' && (
        <>
          <div className="flex items-center gap-3">
            <SectionLabel className="flex-1">Últimos 14 días de actividad</SectionLabel>
            <button
              onClick={() => fetchClientDailyLogs(clientId, 14)}
              className="text-xs text-kore-red font-medium"
            >
              Actualizar
            </button>
          </div>
          {dailyLogsLoading && dailyLogs.length === 0 ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
            </div>
          ) : dailyLogs.length === 0 ? (
            <EmptyState
              title="Sin registros aún"
              description="El cliente todavía no ha registrado actividad. Aparecerá aquí cuando empiece su programa."
            />
          ) : (
            <div className="space-y-3">
              {dailyLogs.map((day) => (
                <div key={day.date} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-kore-gray-dark">
                        {new Date(day.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-kore-gray-dark/40">Día {day.day_number} · {day.day_type}</p>
                    </div>
                    <div className="w-12 h-12">
                      <AdherenceRing value={day.training_adherence} size={48} strokeWidth={5} color="rgb(239, 68, 68)" />
                    </div>
                  </div>
                  {day.exercises.length > 0 && (
                    <div className="space-y-1">
                      {day.exercises.map((ex, i) => {
                        const done = ex.status === 'completed';
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-100' : 'bg-kore-gray-light/30'}`}>
                              {done && (
                                <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </span>
                            <span className={`text-xs flex-1 ${done ? 'text-kore-gray-dark/70' : 'text-kore-gray-dark/40'}`}>
                              {ex.exercise_name}
                            </span>
                            <span className="text-[10px] text-kore-gray-dark/30">
                              {ex.sets}x{ex.reps ?? `${ex.duration_seconds}s`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
