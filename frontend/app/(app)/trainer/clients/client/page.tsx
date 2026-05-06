'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import TabBar from '@/app/components/trainer/TabBar';
import AdherenceRing from '@/app/components/trainer/AdherenceRing';
import KPIGrid from '@/app/components/trainer/KPIGrid';
import RiskBadge from '@/app/components/trainer/RiskBadge';
import AlertCard from '@/app/components/trainer/AlertCard';

type TabId = 'resumen' | 'sesiones' | 'rutina' | 'nutricion' | 'evaluaciones' | 'alertas' | 'creditos' | 'notas';

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'sesiones', label: 'Sesiones' },
  { id: 'rutina', label: 'Rutina' },
  { id: 'nutricion', label: 'Nutrición' },
  { id: 'evaluaciones', label: 'Evaluaciones' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'creditos', label: 'Créditos' },
  { id: 'notas', label: 'Notas' },
];

const GOAL_LABELS: Record<string, string> = {
  fat_loss: 'Perder grasa', muscle_gain: 'Ganar masa muscular',
  rehab: 'Rehabilitación', general_health: 'Salud general',
  sports_performance: 'Rendimiento deportivo',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Completada', bg: 'bg-green-100', text: 'text-green-700' },
  pending: { label: 'Pendiente', bg: 'bg-amber-100', text: 'text-amber-700' },
  canceled: { label: 'Cancelada', bg: 'bg-red-100', text: 'text-red-600' },
};

const EVAL_MODULES = [
  { key: 'anthropometry', label: 'Antropometría', path: 'anthropometry' },
  { key: 'posturometry', label: 'Posturometría', path: 'posturometry' },
  { key: 'physical', label: 'Eval. Física', path: 'physical-evaluation' },
  { key: 'parq', label: 'PAR-Q+', path: 'parq' },
  { key: 'nutrition', label: 'Nutrición', path: 'nutrition' },
];

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Desayuno', morning_snack: 'Media mañana', lunch: 'Almuerzo',
  afternoon_snack: 'Merienda', dinner: 'Cena',
};

function evalUrgency(lastDate: string | null): { color: string; label: string } {
  if (!lastDate) return { color: 'text-kore-red', label: 'Sin registro' };
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
  if (days > 120) return { color: 'text-kore-red', label: `${days}d` };
  if (days > 60) return { color: 'text-amber-600', label: `${days}d` };
  return { color: 'text-green-600', label: `${days}d` };
}

export default function TrainerClientDetailWrapper() {
  return (
    <Suspense>
      <TrainerClientDetailPage />
    </Suspense>
  );
}

function TrainerClientDetailPage() {
  const searchParams = useSearchParams();
  const clientId = Number(searchParams.get('id'));

  const {
    selectedClient: client,
    clientLoading,
    clientSessions,
    sessionsLoading,
    fetchClientDetail,
    fetchClientSessions,
    error,
    clientKPIs,
    kpiLoading,
    fetchClientKPI,
    clientAlerts,
    clientAlertsLoading,
    fetchClientAlerts,
    resolveAlert,
    fetchAlerts,
    clientDailyLogs,
    dailyLogsLoading,
    fetchClientDailyLogs,
    clientNutritionLogs,
    nutritionLogsLoading,
    fetchClientNutritionLogs,
    clientSessionsFull,
    sessionsFullLoading,
    fetchClientSessionsFull,
    trainerMessages,
    messagesLoading,
    sendTrainerMessage,
    fetchTrainerMessages,
    pauseProgram,
    resumeProgram,
    programActionLoading,
  } = useTrainerStore();

  const [activeTab, setActiveTab] = useState<TabId>('resumen');
  const [newMessage, setNewMessage] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [showPauseSheet, setShowPauseSheet] = useState(false);
  const [resolvingAlertId, setResolvingAlertId] = useState<number | null>(null);
  const [resolveSheet, setResolveSheet] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveType, setResolveType] = useState<'mark_reviewed' | 'private_note' | 'public_note' | 'schedule_eval'>('mark_reviewed');

  useEffect(() => {
    if (!clientId) return;
    fetchClientDetail(clientId);
    fetchClientSessions(clientId);
  }, [clientId, fetchClientDetail, fetchClientSessions]);

  useEffect(() => {
    if (!clientId) return;
    if (activeTab === 'resumen' && !clientKPIs[clientId]) fetchClientKPI(clientId);
    if (activeTab === 'sesiones' && !clientSessionsFull[clientId]) fetchClientSessionsFull(clientId);
    if (activeTab === 'rutina' && !clientDailyLogs[clientId]) fetchClientDailyLogs(clientId, 14);
    if (activeTab === 'nutricion' && !clientNutritionLogs[clientId]) fetchClientNutritionLogs(clientId, 14);
    if (activeTab === 'evaluaciones' && !clientKPIs[clientId]) fetchClientKPI(clientId);
    if (activeTab === 'alertas' && !clientAlerts[clientId]) fetchClientAlerts(clientId);
    if (activeTab === 'notas' && !trainerMessages[clientId]) fetchTrainerMessages(clientId);
  }, [activeTab, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = clientKPIs[clientId];
  const alerts = clientAlerts[clientId] ?? [];
  const dailyLogs = clientDailyLogs[clientId] ?? [];
  const nutritionLogs = clientNutritionLogs[clientId] ?? [];
  const fullSessions = clientSessionsFull[clientId] ?? clientSessions;
  const messages = trainerMessages[clientId] ?? [];

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !clientId) return;
    await sendTrainerMessage(clientId, newMessage.trim());
    setNewMessage('');
    fetchTrainerMessages(clientId);
  };

  const handleResolveAlert = async () => {
    if (!resolveSheet) return;
    setResolvingAlertId(resolveSheet);
    try {
      await resolveAlert(resolveSheet, { signal_type: 'general', resolution_type: resolveType, note: resolveNote, is_public: resolveType === 'public_note' });
      setResolveSheet(null);
      setResolveNote('');
      await fetchClientAlerts(clientId);
      await fetchAlerts();
    } finally {
      setResolvingAlertId(null);
    }
  };

  const activeProgram = client?.subscription;
  const programId = kpi?.behavioral?.sessions_remaining != null ? null : null;

  if (clientLoading && !client) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto">

        {/* Back link */}
        <Link
          href="/trainer/clients"
          className="inline-flex items-center gap-1 text-xs text-kore-gray-dark/40 hover:text-kore-red transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Volver a clientes
        </Link>

        {error && (
          <div className="bg-kore-red/5 border border-kore-red/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-kore-red">{error}</p>
          </div>
        )}

        {/* Header: avatar + name + next session */}
        {client && (
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 mb-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/20 flex-shrink-0 overflow-hidden">
                {client.avatar_url ? (
                  <Image src={client.avatar_url} alt="" fill className="object-cover" />
                ) : (
                  <span className="text-xl font-bold text-white">{client.first_name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-lg leading-tight truncate">
                  {client.first_name} {client.last_name}
                </p>
                <p className="text-white/50 text-xs truncate">{GOAL_LABELS[client.profile.primary_goal] ?? client.profile.primary_goal}</p>
              </div>
              {alerts.filter(a => a.level === 'alto' || a.level === 'medio').length > 0 && (
                <RiskBadge level={alerts[0]?.level ?? 'bajo'} size="sm" />
              )}
            </div>
            {client.next_session && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
                <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <div className="min-w-0">
                  <p className="text-white/50 text-[10px] uppercase tracking-wide">Próxima sesión</p>
                  <p className="text-white text-sm font-medium">
                    {new Date(client.next_session.starts_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '}·{' '}
                    {new Date(client.next_session.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab bar */}
        <TabBar tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

        {/* Tab content */}
        <div className="pt-4 space-y-4">

          {/* ── RESUMEN ── */}
          {activeTab === 'resumen' && (
            <>
              {kpiLoading && !kpi ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
                </div>
              ) : kpi ? (
                <>
                  {/* Adherence rings */}
                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-around">
                      <AdherenceRing
                        value={kpi.behavioral.combined_adherence_7d}
                        size={100}
                        strokeWidth={9}
                        label="Adherencia"
                        color="rgb(239, 68, 68)"
                      />
                      {kpi.clinical.kore_score !== null && (
                        <div className="text-center">
                          <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wide mb-1">KORE Score</p>
                          <p className="text-4xl font-black text-white leading-none">
                            {Math.round(kpi.clinical.kore_score)}
                          </p>
                          <p className="text-white/50 text-xs mt-0.5">{kpi.clinical.kore_category}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <KPIGrid items={[
                    { label: 'Racha actual', value: kpi.behavioral.streak_current, unit: 'días' },
                    { label: 'Racha récord', value: kpi.behavioral.streak_longest, unit: 'días' },
                    { label: 'Sesiones comp.', value: kpi.behavioral.sessions_completed },
                    { label: 'Créditos rest.', value: kpi.behavioral.sessions_remaining },
                  ]} />

                  {/* Clinical grid */}
                  <KPIGrid columns={3} items={[
                    { label: 'BMI', value: kpi.clinical.bmi?.toFixed(1) ?? null, color: kpi.clinical.bmi_color },
                    { label: '% Grasa', value: kpi.clinical.body_fat_pct?.toFixed(1) ?? null, unit: '%', color: kpi.clinical.bf_color },
                    { label: 'Postural', value: kpi.clinical.global_postural_index?.toFixed(0) ?? null, color: kpi.clinical.postural_color },
                    { label: 'Física', value: kpi.clinical.physical_general_index?.toFixed(0) ?? null, color: kpi.clinical.physical_color },
                    { label: 'Nutrición', value: kpi.clinical.nutrition_habit_score?.toFixed(1) ?? null, unit: '/10', color: kpi.clinical.nutrition_color },
                    { label: 'Ánimo', value: kpi.behavioral.last_mood_score?.toString() ?? null, unit: '/10' },
                  ]} />

                  {/* Active alerts preview */}
                  {alerts.length > 0 && (
                    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-kore-gray-dark">Alertas activas</p>
                        <button onClick={() => setActiveTab('alertas')} className="text-xs text-kore-red font-medium">Ver todas</button>
                      </div>
                      <div className="space-y-2">
                        {alerts.slice(0, 2).map((a) => (
                          <div key={a.id} className="flex items-center gap-2">
                            <RiskBadge level={a.level} size="sm" />
                            <span className="text-xs text-kore-gray-dark/60">
                              {(a.behavioral_signals.length + a.clinical_signals.length)} señales
                            </span>
                            <span className="text-xs text-kore-gray-dark/30 ml-auto">
                              {new Date(a.computed_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-3">
                  {client && (
                    <>
                      <p className="text-sm font-bold text-kore-gray-dark">Sesiones</p>
                      <KPIGrid items={[
                        { label: 'Completadas', value: client.stats.completed },
                        { label: 'Pendientes', value: client.stats.pending },
                        { label: 'Canceladas', value: client.stats.canceled },
                        { label: 'Total', value: client.stats.total },
                      ]} />
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── SESIONES ── */}
          {activeTab === 'sesiones' && (
            <>
              {/* Upcoming */}
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-sm font-bold text-kore-gray-dark">Próximas</p>
                </div>
                <div className="px-3 pb-3">
                  {(() => {
                    const upcoming = (fullSessions.length > 0 ? fullSessions : clientSessions).filter(
                      (s) => s.status === 'pending' && s.starts_at && new Date(s.starts_at) > new Date()
                    );
                    return upcoming.length === 0 ? (
                      <p className="text-sm text-kore-gray-dark/40 text-center py-4">Sin sesiones próximas</p>
                    ) : (
                      <div className="space-y-0.5">
                        {upcoming.map((s) => (
                          <SessionRow key={s.id} session={s} />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* History */}
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-sm font-bold text-kore-gray-dark">Historial</p>
                </div>
                <div className="px-3 pb-3">
                  {sessionsLoading || sessionsFullLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin h-5 w-5 border-2 border-kore-red border-t-transparent rounded-full" />
                    </div>
                  ) : (() => {
                    const past = (fullSessions.length > 0 ? fullSessions : clientSessions).filter(
                      (s) => s.status === 'confirmed' || s.status === 'canceled'
                    );
                    return past.length === 0 ? (
                      <p className="text-sm text-kore-gray-dark/40 text-center py-4">Sin historial de sesiones</p>
                    ) : (
                      <div className="space-y-0.5">
                        {past.map((s) => (
                          <SessionRow key={s.id} session={s} />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          {/* ── RUTINA ── */}
          {activeTab === 'rutina' && (
            <>
              <div className="flex items-center gap-3">
                <p className="text-xs text-kore-gray-dark/40 flex-1">Últimos 14 días de actividad</p>
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
                <div className="text-center py-10">
                  <p className="text-sm text-kore-gray-dark/50">Sin registros de rutina</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dailyLogs.map((day) => (
                    <div key={day.date} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-kore-gray-dark">
                            {new Date(day.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-xs text-kore-gray-dark/40">Día {day.day_number} · {day.day_type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-12">
                            <AdherenceRing value={day.training_adherence} size={48} strokeWidth={5} color="rgb(239, 68, 68)" />
                          </div>
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

          {/* ── NUTRICIÓN ── */}
          {activeTab === 'nutricion' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-kore-gray-dark/40">Últimos 14 días de nutrición</p>
                <button
                  onClick={() => fetchClientNutritionLogs(clientId, 14)}
                  className="text-xs text-kore-red font-medium"
                >
                  Actualizar
                </button>
              </div>
              {nutritionLogsLoading && nutritionLogs.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
                </div>
              ) : nutritionLogs.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-kore-gray-dark/50">Sin registros de nutrición</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {nutritionLogs.map((day) => (
                    <div key={day.date} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-kore-gray-dark">
                            {new Date(day.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-xs text-kore-gray-dark/40">{day.is_closed ? 'Cerrado' : 'Abierto'}</p>
                        </div>
                        <div className="w-12 h-12">
                          <AdherenceRing value={day.adherence} size={48} strokeWidth={5} color="rgb(52, 211, 153)" />
                        </div>
                      </div>
                      {day.meals.length > 0 && (
                        <div className="space-y-1.5">
                          {day.meals.map((meal) => (
                            <div key={meal.meal_entry_id} className="flex items-start gap-2">
                              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${meal.status === 'completed' ? 'bg-green-400' : meal.status === 'skipped' ? 'bg-gray-300' : 'bg-amber-300'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-kore-gray-dark/70">
                                  {MEAL_LABELS[meal.meal_block] ?? meal.meal_block}
                                </p>
                                {meal.notes && (
                                  <p className="text-[10px] text-kore-gray-dark/40 truncate">{meal.notes}</p>
                                )}
                                {meal.trainer_comment && (
                                  <p className="text-[10px] text-kore-red/70 italic truncate">Tu nota: {meal.trainer_comment}</p>
                                )}
                              </div>
                              {meal.photo_url && (
                                <span className="w-4 h-4 flex-shrink-0 rounded bg-kore-cream flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-kore-gray-dark/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── EVALUACIONES ── */}
          {activeTab === 'evaluaciones' && (
            <>
              {kpiLoading && !kpi ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  {EVAL_MODULES.map((mod) => {
                    const lastDate = kpi?.clinical.last_eval_dates?.[mod.key] ?? null;
                    const { color, label } = evalUrgency(lastDate);
                    return (
                      <div key={mod.key} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-kore-gray-dark">{mod.label}</p>
                          <p className={`text-xs font-medium ${color}`}>
                            {lastDate ? `Hace ${label}` : 'Sin registro'}
                          </p>
                        </div>
                        <Link
                          href={`/trainer/clients/client/${mod.path}?id=${clientId}`}
                          className="px-3 py-1.5 rounded-xl bg-kore-cream text-kore-gray-dark/60 text-xs font-medium active:scale-95 transition-transform duration-100 flex-shrink-0"
                        >
                          Ver
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── ALERTAS ── */}
          {activeTab === 'alertas' && (
            <>
              {clientAlertsLoading && alerts.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-kore-gray-dark/50">Sin alertas registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onResolve={(id) => {
                        setResolveNote('');
                        setResolveType('mark_reviewed');
                        setResolveSheet(id);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── CRÉDITOS ── */}
          {activeTab === 'creditos' && client?.subscription && (
            <div className="space-y-4">
              {/* Hero */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 shadow-lg text-center">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Sesiones restantes</p>
                <p className="text-6xl font-black text-white leading-none">{client.subscription.sessions_remaining}</p>
                <p className="text-white/40 text-sm mt-1">de {client.subscription.sessions_total} totales</p>
                <div className="w-full h-1.5 bg-white/10 rounded-full mt-3">
                  <div
                    className="h-full rounded-full bg-kore-red transition-all duration-700"
                    style={{ width: `${(client.subscription.sessions_used / client.subscription.sessions_total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-3">
                <DetailRow label="Programa" value={client.subscription.package_title} />
                <DetailRow
                  label="Valor"
                  value={new Intl.NumberFormat('es-CO', { style: 'currency', currency: client.subscription.package_currency, minimumFractionDigits: 0 }).format(parseFloat(client.subscription.package_price))}
                />
                <DetailRow label="Estado" value={client.subscription.status} />
                <DetailRow label="Inicio" value={formatDate(client.subscription.starts_at)} />
                <DetailRow label="Vencimiento" value={formatDate(client.subscription.expires_at)} />
                {client.subscription.next_billing_date && (
                  <DetailRow label="Próximo cobro" value={formatDate(client.subscription.next_billing_date)} />
                )}
                <DetailRow label="Cobro automático" value={client.subscription.is_recurring ? 'Sí' : 'No'} />
                {client.last_payment && (
                  <DetailRow
                    label="Último pago"
                    value={`${new Intl.NumberFormat('es-CO', { style: 'currency', currency: client.last_payment.currency, minimumFractionDigits: 0 }).format(parseFloat(client.last_payment.amount))} · ${formatDate(client.last_payment.created_at)}`}
                  />
                )}
              </div>
            </div>
          )}
          {activeTab === 'creditos' && !client?.subscription && (
            <div className="text-center py-10">
              <p className="text-sm text-kore-gray-dark/50">Sin suscripción activa</p>
            </div>
          )}

          {/* ── NOTAS ── */}
          {activeTab === 'notas' && (
            <div className="space-y-4">
              {/* Composer */}
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/40">Nuevo mensaje</p>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                  placeholder="Escribe un mensaje para este cliente..."
                  className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 resize-none focus:outline-none focus:ring-2 focus:ring-kore-red/30"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="w-full py-2.5 rounded-xl bg-kore-red text-white text-sm font-medium active:scale-95 transition-transform duration-100 disabled:opacity-40"
                >
                  Enviar mensaje
                </button>
              </div>

              {/* History */}
              {messagesLoading && messages.length === 0 ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin h-5 w-5 border-2 border-kore-red border-t-transparent rounded-full" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-kore-gray-dark/40">Sin mensajes enviados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
                      <p className="text-sm text-kore-gray-dark leading-relaxed">{msg.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-kore-gray-dark/30">
                          {new Date(msg.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className={`text-[10px] font-medium ${msg.seen_by_customer ? 'text-green-600' : 'text-kore-gray-dark/30'}`}>
                          {msg.seen_by_customer ? 'Visto' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Resolve Alert Sheet */}
      {resolveSheet !== null && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setResolveSheet(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-kore-gray-light rounded-full" />
            </div>
            <div className="px-4 pt-2 pb-8 space-y-4">
              <p className="text-base font-semibold text-kore-gray-dark">Resolver alerta</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {(['mark_reviewed', 'private_note', 'public_note', 'schedule_eval'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setResolveType(t)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${resolveType === t ? 'bg-kore-gray-dark text-white' : 'bg-kore-cream text-kore-gray-dark/60'}`}
                  >
                    {{ mark_reviewed: 'Revisado', private_note: 'Nota privada', public_note: 'Nota pública', schedule_eval: 'Agendar eval' }[t]}
                  </button>
                ))}
              </div>
              {resolveType !== 'mark_reviewed' && (
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  rows={3}
                  placeholder="Escribe una nota..."
                  className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark resize-none focus:outline-none focus:ring-2 focus:ring-kore-red/30"
                />
              )}
              <div className="flex gap-3">
                <button onClick={() => setResolveSheet(null)} className="flex-1 py-3 rounded-xl bg-kore-cream text-kore-gray-dark/60 text-sm font-medium active:scale-95 transition-transform duration-100">Cancelar</button>
                <button
                  onClick={handleResolveAlert}
                  disabled={resolvingAlertId !== null}
                  className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-medium active:scale-95 transition-transform duration-100 disabled:opacity-60"
                >
                  {resolvingAlertId ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pause Sheet */}
      {showPauseSheet && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowPauseSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-kore-gray-light rounded-full" />
            </div>
            <div className="px-4 pt-2 pb-8 space-y-4">
              <p className="text-base font-semibold text-kore-gray-dark">Pausar programa</p>
              <textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                rows={3}
                placeholder="Motivo de la pausa..."
                className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark resize-none focus:outline-none focus:ring-2 focus:ring-kore-red/30"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowPauseSheet(false)} className="flex-1 py-3 rounded-xl bg-kore-cream text-kore-gray-dark/60 text-sm font-medium">Cancelar</button>
                <button
                  onClick={async () => {
                    if (!programId) return;
                    await pauseProgram(clientId, programId, pauseReason);
                    setShowPauseSheet(false);
                    setPauseReason('');
                  }}
                  disabled={programActionLoading}
                  className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-medium disabled:opacity-60"
                >
                  {programActionLoading ? 'Pausando...' : 'Confirmar pausa'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SessionRow({ session }: { session: { id: number; status: string; package_title: string; starts_at: string | null; ends_at: string | null; notes: string; canceled_reason: string; session_notes_for_customer: string; created_at: string } }) {
  const sc = STATUS_CONFIG[session.status] ?? { label: session.status, bg: 'bg-gray-100', text: 'text-gray-500' };
  const date = session.starts_at
    ? new Date(session.starts_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
  const time = session.starts_at
    ? new Date(session.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';
  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-kore-cream/60 transition-colors">
      <div className={`w-8 h-8 rounded-full ${sc.bg} flex items-center justify-center flex-shrink-0`}>
        <svg className={`w-4 h-4 ${sc.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          {session.status === 'confirmed' ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : session.status === 'canceled' ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-kore-gray-dark truncate">{session.package_title}</p>
        <p className="text-xs text-kore-gray-dark/40 capitalize">{date}{time ? ` · ${time}` : ''}</p>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sc.bg} ${sc.text}`}>
        {sc.label}
      </span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <span className="text-kore-gray-dark/50 flex-shrink-0">{label}</span>
      <span className="font-medium text-kore-gray-dark text-right">{value}</span>
    </div>
  );
}
