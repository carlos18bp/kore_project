'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import TabBar from '@/app/components/trainer/TabBar';
import AdherenceRing from '@/app/components/trainer/AdherenceRing';
import KPIGrid from '@/app/components/trainer/KPIGrid';
import RiskBadge from '@/app/components/trainer/RiskBadge';
import AlertCard from '@/app/components/trainer/AlertCard';
import ClientProgramTab from '@/app/components/trainer/ClientProgramTab';
import PostSessionMessageSheet from '@/app/components/trainer/PostSessionMessageSheet';
import SectionLabel from '@/app/components/shared/SectionLabel';
import EmptyState from '@/app/components/shared/EmptyState';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import EvalAntropTab from '@/app/components/trainer/evals/EvalAntropTab';
import EvalPosturTab from '@/app/components/trainer/evals/EvalPosturTab';
import EvalFisicaTab from '@/app/components/trainer/evals/EvalFisicaTab';
import EvalParqTab from '@/app/components/trainer/evals/EvalParqTab';
import NotesTab from '@/app/components/trainer/NotesTab';
import ClientNutritionTab from '@/app/components/trainer/ClientNutritionTab';

type TabId =
  | 'resumen' | 'programa'
  | 'antrop' | 'postur' | 'fisica' | 'parq'
  | 'nutri' | 'alertas' | 'notas';

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumen',   label: 'Resumen' },
  { id: 'programa',  label: 'Programa' },
  { id: 'antrop',    label: 'Antropometría' },
  { id: 'postur',    label: 'Posturometría' },
  { id: 'fisica',    label: 'Ev. Física' },
  { id: 'parq',      label: 'PAR-Q+' },
  { id: 'nutri',     label: 'Nutrición' },
  { id: 'alertas',   label: 'Alertas' },
  { id: 'notas',     label: 'Notas' },
];

const EVAL_LINKS: Record<string, { label: string; path: string; desc: string }> = {
  antrop: { label: 'Antropometría', path: 'anthropometry',       desc: 'Composición corporal, IMC, pliegues cutáneos y perímetros.' },
  postur: { label: 'Posturometría', path: 'posturometry',        desc: 'Análisis de alineación postural y correcciones.' },
  fisica: { label: 'Ev. Física',    path: 'physical-evaluation', desc: 'Fuerza, resistencia y capacidad funcional.' },
  parq:   { label: 'PAR-Q+',        path: 'parq',                desc: 'Cuestionario de aptitud física y contraindicaciones.' },
};

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Completada', bg: 'bg-kore-sage/20',   text: 'text-kore-sage-deep' },
  pending:   { label: 'Pendiente',  bg: 'bg-amber-100',      text: 'text-amber-700' },
  canceled:  { label: 'Cancelada',  bg: 'bg-red-100',        text: 'text-red-600' },
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Desayuno', morning_snack: 'Media mañana', lunch: 'Almuerzo',
  afternoon_snack: 'Merienda', dinner: 'Cena',
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function koreColor(score: number | null) {
  if (!score) return '#9CA3AF';
  if (score >= 75) return '#669959';
  if (score >= 50) return '#D97706';
  return '#9A0526';
}

function evalUrgency(d: string | null) {
  if (!d) return { color: 'text-kore-crimson', label: 'Sin registro' };
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days > 120) return { color: 'text-kore-crimson', label: `${days}d` };
  if (days > 60)  return { color: 'text-amber-600',    label: `${days}d` };
  return { color: 'text-kore-sage-deep', label: `${days}d` };
}

export default function TrainerClientDetailWrapper() {
  return <Suspense><TrainerClientDetailPage /></Suspense>;
}

function TrainerClientDetailPage() {
  const searchParams = useSearchParams();
  const clientId = Number(searchParams.get('id'));

  const {
    selectedClient: client, clientLoading, fetchClientDetail,
    clientSessions, fetchClientSessions,
    error,
    clientKPIs, kpiLoading, fetchClientKPI,
    clientAlerts, clientAlertsLoading, fetchClientAlerts,
    resolveAlert, fetchAlerts,
    clientNutritionLogs, nutritionLogsLoading, fetchClientNutritionLogs,
    clientSessionsFull, sessionsFullLoading, fetchClientSessionsFull,
    trainerMessages, messagesLoading, sendTrainerMessage, fetchTrainerMessages,
    pauseProgram, programActionLoading,
  } = useTrainerStore();

  const [activeTab, setActiveTab] = useState<TabId>('resumen');
  const [postSessionSheet, setPostSessionSheet] = useState<{ sessionId: number } | null>(null);
  const [pauseReason, setPauseReason] = useState('');
  const [showPauseSheet, setShowPauseSheet] = useState(false);
  const [resolvingAlertId, setResolvingAlertId] = useState<number | null>(null);
  const [resolveSheet, setResolveSheet] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveType, setResolveType] = useState<'mark_reviewed' | 'private_note' | 'public_note' | 'schedule_eval'>('mark_reviewed');
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    if (!clientId) return;
    fetchClientDetail(clientId);
    fetchClientSessions(clientId);
  }, [clientId, fetchClientDetail, fetchClientSessions]);

  useEffect(() => {
    if (!clientId) return;
    if (activeTab === 'resumen'  && !clientKPIs[clientId])          fetchClientKPI(clientId);
    if (activeTab === 'resumen'  && !clientSessionsFull[clientId])  fetchClientSessionsFull(clientId);
    if (activeTab === 'nutri'    && !clientNutritionLogs[clientId]) fetchClientNutritionLogs(clientId, 14);
    if (activeTab === 'alertas'  && !clientAlerts[clientId])        fetchClientAlerts(clientId);
    if (activeTab === 'notas'    && !trainerMessages[clientId])     fetchTrainerMessages(clientId);
    if ((activeTab === 'antrop' || activeTab === 'postur' || activeTab === 'fisica' || activeTab === 'parq') && !clientKPIs[clientId]) {
      fetchClientKPI(clientId);
    }
  }, [activeTab, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi          = clientKPIs[clientId];
  const alerts       = clientAlerts[clientId] ?? [];
  const nutritionLogs = clientNutritionLogs[clientId] ?? [];
  const fullSessions = clientSessionsFull[clientId] ?? clientSessions;
  const messages     = trainerMessages[clientId] ?? [];
  const programId    = null as number | null;

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleSendMessage = async (text: string, triggerType: 'manual' | 'post_session' | 'post_milestone') => {
    if (!clientId) return;
    await sendTrainerMessage(clientId, text, triggerType);
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

  if (clientLoading && !client) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 rounded-full"
          style={{ borderColor: 'rgba(103,15,34,0.15)', borderTopColor: '#670F22' }} />
      </section>
    );
  }

  const topAlert = alerts.find(a => a.level === 'alto') ?? alerts.find(a => a.level === 'medio');

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-4">

        {/* Back */}
        <Link href="/trainer/clients"
          className="inline-flex items-center gap-1 font-body text-[11px] transition-colors"
          style={{ color: 'rgba(103,15,34,0.45)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Volver a clientes
        </Link>

        {error && (
          <div className="rounded-[14px] px-4 py-3" style={{ background: 'rgba(154,5,38,0.06)', border: '1px solid rgba(154,5,38,0.15)' }}>
            <p className="font-body text-[13px] text-kore-crimson">{error}</p>
          </div>
        )}

        {/* ── Client Header ── */}
        {client && (
          <div style={{ padding: '8px 4px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
              {/* Avatar */}
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, #F4C7C7, #E7C8A0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid rgba(231,200,160,0.50)', overflow: 'hidden' }}>
                {client.avatar_url
                  ? <img src={client.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: 'Cinzel, serif', fontSize: 24, fontWeight: 700, color: '#2D0F1A' }}>
                      {initials(`${client.first_name} ${client.last_name}`)}
                    </span>}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + badge inline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 600, color: '#670F22', letterSpacing: '-0.005em', lineHeight: 1.1, margin: 0 }}>
                    {client.first_name} {client.last_name}
                  </h1>
                  {topAlert && <RiskBadge level={topAlert.level} size="sm" />}
                </div>

                {/* Metadata — single bullet line */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0, marginTop: 7, fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(103,15,34,0.55)' }}>
                  <span>{client.email}</span>
                  {client.subscription && (
                    <>
                      <span style={{ margin: '0 7px', opacity: 0.45 }}>•</span>
                      <span>{client.subscription.package_title}</span>
                    </>
                  )}
                  <span style={{ margin: '0 7px', opacity: 0.45 }}>•</span>
                  <span>{client.stats.completed}/{client.stats.total} sesiones</span>
                </div>
              </div>
            </div>

            {/* Stats strip */}
            <div style={{ display: 'flex', gap: 1, marginTop: 20, borderRadius: 14, overflow: 'hidden', background: 'rgba(103,15,34,0.06)' }}>
              {[
                { label: 'Completadas', value: client.stats.completed },
                { label: 'Sesiones',    value: client.subscription?.sessions_remaining ?? 0 },
                { label: 'Canceladas',  value: client.stats.canceled },
                { label: 'Total',       value: client.stats.total },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, padding: '10px 4px', textAlign: 'center', background: '#F5EFE3' }}>
                  <p style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 600, color: '#670F22', lineHeight: 1, margin: 0 }}>{s.value}</p>
                  <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(103,15,34,0.45)', marginTop: 4, marginBottom: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        <TabBar tabs={TABS} activeTab={activeTab} onChange={id => setActiveTab(id as TabId)} />

        {/* ── Tab content ── */}
        <div className="space-y-4 pt-5">

          {/* ── RESUMEN ── */}
          {activeTab === 'resumen' && (
            <>
              {kpiLoading && !kpi ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-6 w-6 border-2 rounded-full"
                    style={{ borderColor: 'rgba(103,15,34,0.15)', borderTopColor: '#670F22' }} />
                </div>
              ) : kpi ? (
                <>
                  {/* Dark hero — KÓRE arc + module scores */}
                  <div className="rounded-[22px] p-6"
                    style={{ background: 'linear-gradient(135deg, #2D0F1A 0%, #4A1828 50%, #670F22 100%)' }}>
                    <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase mb-4"
                      style={{ color: 'rgba(231,200,160,0.65)' }}>Índice de salud KÓRE</p>

                    {/* KÓRE arc */}
                    <div className="flex items-center gap-6">
                      <div className="flex-shrink-0">
                        <KoreArc score={kpi.clinical.kore_score} />
                      </div>

                      {/* Module scores */}
                      <div className="flex-1 space-y-2.5">
                        {[
                          { label: 'IMC',         value: kpi.clinical.bmi,                    unit: '',    color: kpi.clinical.bmi_color },
                          { label: '% Grasa',     value: kpi.clinical.body_fat_pct,            unit: '%',   color: kpi.clinical.bf_color },
                          { label: 'Postura',     value: kpi.clinical.global_postural_index,  unit: '',    color: kpi.clinical.postural_color },
                          { label: 'Física',      value: kpi.clinical.physical_general_index, unit: '',    color: kpi.clinical.physical_color },
                        ].map(m => (
                          <ModuleScoreBar key={m.label} {...m} />
                        ))}
                      </div>
                    </div>

                    {/* Adherence row */}
                    <div className="mt-5 pt-4 grid grid-cols-3 gap-3"
                      style={{ borderTop: '1px solid rgba(231,200,160,0.15)' }}>
                      {[
                        { label: 'Entrenamiento', value: kpi.behavioral.training_adherence_7d },
                        { label: 'Nutrición',     value: kpi.behavioral.nutrition_adherence_7d },
                        { label: 'Combinada',     value: kpi.behavioral.combined_adherence_7d },
                      ].map(a => (
                        <div key={a.label} className="text-center">
                          <p className="font-heading text-[22px] font-semibold text-kore-ivory leading-none">
                            {Math.round(a.value * 100)}%
                          </p>
                          <p className="font-body text-[9px] font-bold uppercase tracking-wide mt-1"
                            style={{ color: 'rgba(231,200,160,0.55)' }}>{a.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Behavioral KPIs */}
                  <div className="bg-white/65 rounded-[22px] p-5"
                    style={{ border: '1px solid rgba(103,15,34,0.08)' }}>
                    <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase mb-3"
                      style={{ color: 'rgba(103,15,34,0.55)' }}>Conducta y racha</p>
                    <KPIGrid items={[
                      { label: 'Racha actual',   value: kpi.behavioral.streak_current,   unit: 'días' },
                      { label: 'Racha récord',   value: kpi.behavioral.streak_longest,   unit: 'días' },
                      { label: 'Sesiones comp.', value: kpi.behavioral.sessions_completed },
                      { label: 'Sesiones rest.', value: kpi.behavioral.sessions_remaining },
                    ]} />
                  </div>

                  {/* Next session */}
                  {client?.next_session && (
                    <div className="bg-white/65 rounded-[22px] p-5"
                      style={{ border: '1px solid rgba(103,15,34,0.08)' }}>
                      <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase mb-2"
                        style={{ color: 'rgba(103,15,34,0.55)' }}>Próxima sesión</p>
                      <p className="font-heading text-[17px] font-semibold text-kore-wine-dark">
                        {new Date(client.next_session.starts_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <p className="font-body text-[13px] mt-0.5" style={{ color: 'rgba(103,15,34,0.50)' }}>
                        {new Date(client.next_session.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        {' · '}{client.next_session.package_title}
                      </p>
                    </div>
                  )}

                  {/* Recent sessions */}
                  {clientSessions.length > 0 && (
                    <div className="bg-white/65 rounded-[22px] p-5"
                      style={{ border: '1px solid rgba(103,15,34,0.08)' }}>
                      <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase mb-3"
                        style={{ color: 'rgba(103,15,34,0.55)' }}>Sesiones recientes</p>
                      <div className="space-y-1">
                        {clientSessions.slice(0, 4).map(s => (
                          <SessionRow key={s.id} session={s} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alerts preview */}
                  {alerts.length > 0 && (
                    <div className="bg-white/65 rounded-[22px] p-5"
                      style={{ border: '1px solid rgba(103,15,34,0.08)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase"
                          style={{ color: 'rgba(103,15,34,0.55)' }}>Alertas activas</p>
                        <button onClick={() => setActiveTab('alertas')}
                          className="font-body text-[12px] font-semibold text-kore-crimson">Ver todas</button>
                      </div>
                      <div className="space-y-2">
                        {alerts.slice(0, 2).map(a => (
                          <div key={a.id} className="flex items-center gap-2">
                            <RiskBadge level={a.level} size="sm" />
                            <span className="font-body text-[12px]" style={{ color: 'rgba(103,15,34,0.55)' }}>
                              {a.behavioral_signals.length + a.clinical_signals.length} señales
                            </span>
                            <span className="font-body text-[11px] ml-auto" style={{ color: 'rgba(103,15,34,0.35)' }}>
                              {new Date(a.computed_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* fallback when no kpi */
                client && (
                  <div className="bg-white/65 rounded-[22px] p-5"
                    style={{ border: '1px solid rgba(103,15,34,0.08)' }}>
                    <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase mb-3"
                      style={{ color: 'rgba(103,15,34,0.55)' }}>Sesiones</p>
                    <KPIGrid items={[
                      { label: 'Completadas', value: client.stats.completed },
                      { label: 'Pendientes',  value: client.stats.pending },
                      { label: 'Canceladas',  value: client.stats.canceled },
                      { label: 'Total',       value: client.stats.total },
                    ]} />
                  </div>
                )
              )}
            </>
          )}

          {/* ── PROGRAMA ── */}
          {activeTab === 'programa' && <ClientProgramTab clientId={clientId} />}

          {/* ── SESIONES ── */}
          {/* ── EVAL TABS ── */}
          {activeTab === 'antrop' && <EvalAntropTab clientId={clientId} />}
          {activeTab === 'postur' && <EvalPosturTab clientId={clientId} />}
          {activeTab === 'fisica' && <EvalFisicaTab clientId={clientId} />}
          {activeTab === 'parq'   && <EvalParqTab   clientId={clientId} />}

          {/* ── NUTRICIÓN ── */}
          {activeTab === 'nutri' && (
            <ClientNutritionTab clientId={clientId} nutritionLogs={nutritionLogs} />
          )}

          {/* ── ALERTAS ── */}
          {activeTab === 'alertas' && (
            <>
              <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase"
                style={{ color: 'rgba(103,15,34,0.55)' }}>Alertas activas del cliente</p>
              {clientAlertsLoading && alerts.length === 0 ? <Spinner /> :
                alerts.length === 0 ? (
                  <EmptyState title="Sin alertas registradas"
                    description="Cuando el cliente cruce un umbral conductual o clínico, su alerta aparecerá aquí." />
                ) : (
                  <div className="space-y-3">
                    {alerts.map(alert => (
                      <AlertCard key={alert.id} alert={alert}
                        onResolve={id => { setResolveNote(''); setResolveType('mark_reviewed'); setResolveSheet(id); }} />
                    ))}
                  </div>
                )}
            </>
          )}

          {/* ── NOTAS / MENSAJES ── */}
          {activeTab === 'notas' && (
            <NotesTab
              clientId={clientId}
              onSendMessage={handleSendMessage}
              messages={messages}
              messagesLoading={messagesLoading}
            />
          )}

        </div>
      </div>

      {/* ── Resolve Alert Sheet ── */}
      {resolveSheet !== null && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setResolveSheet(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(103,15,34,0.15)' }} />
            </div>
            <div className="px-4 pt-2 pb-8 space-y-4">
              <p className="font-heading text-[16px] font-semibold text-kore-wine-dark">Resolver alerta</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {(['mark_reviewed', 'private_note', 'public_note', 'schedule_eval'] as const).map(t => (
                  <button key={t} onClick={() => setResolveType(t)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-body text-[12px] font-semibold transition-all ${resolveType === t ? 'bg-kore-wine-dark text-kore-ivory' : 'bg-kore-cream text-kore-wine-dark/60'}`}>
                    {{ mark_reviewed: 'Revisado', private_note: 'Nota privada', public_note: 'Nota pública', schedule_eval: 'Agendar eval' }[t]}
                  </button>
                ))}
              </div>
              {resolveType !== 'mark_reviewed' && (
                <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={3}
                  placeholder="Escribe una nota..."
                  className="w-full rounded-xl px-3 py-2.5 font-body text-[13px] text-kore-wine-dark resize-none focus:outline-none"
                  style={{ border: '1px solid rgba(103,15,34,0.12)', background: 'rgba(245,239,227,0.50)' }} />
              )}
              <div className="flex gap-3">
                <button onClick={() => setResolveSheet(null)}
                  className="flex-1 py-3 rounded-xl font-body text-[14px] font-semibold"
                  style={{ background: 'rgba(103,15,34,0.06)', color: 'rgba(103,15,34,0.60)' }}>Cancelar</button>
                <button onClick={handleResolveAlert} disabled={resolvingAlertId !== null}
                  className="flex-1 py-3 rounded-xl font-body text-[14px] font-semibold active:scale-95 transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #670F22, #9A0526)', color: '#FFF8EC' }}>
                  {resolvingAlertId ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Pause Sheet ── */}
      {showPauseSheet && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowPauseSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(103,15,34,0.15)' }} />
            </div>
            <div className="px-4 pt-2 pb-8 space-y-4">
              <p className="font-heading text-[16px] font-semibold text-kore-wine-dark">Pausar programa</p>
              <textarea value={pauseReason} onChange={e => setPauseReason(e.target.value)} rows={3}
                placeholder="Motivo de la pausa..."
                className="w-full rounded-xl px-3 py-2.5 font-body text-[13px] text-kore-wine-dark resize-none focus:outline-none"
                style={{ border: '1px solid rgba(103,15,34,0.12)', background: 'rgba(245,239,227,0.50)' }} />
              <div className="flex gap-3">
                <button onClick={() => setShowPauseSheet(false)}
                  className="flex-1 py-3 rounded-xl font-body text-[14px] font-semibold"
                  style={{ background: 'rgba(103,15,34,0.06)', color: 'rgba(103,15,34,0.60)' }}>Cancelar</button>
                <button
                  onClick={async () => {
                    if (!programId) return;
                    await pauseProgram(clientId, programId, pauseReason);
                    setShowPauseSheet(false);
                    setPauseReason('');
                  }}
                  disabled={programActionLoading}
                  className="flex-1 py-3 rounded-xl font-body text-[14px] font-semibold disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #670F22, #9A0526)', color: '#FFF8EC' }}>
                  {programActionLoading ? 'Pausando...' : 'Confirmar pausa'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Post-Session Sheet ── */}
      {postSessionSheet && client && (
        <PostSessionMessageSheet
          customerId={clientId}
          customerName={`${client.first_name} ${client.last_name}`}
          sessionId={postSessionSheet.sessionId}
          onClose={() => { setPostSessionSheet(null); fetchTrainerMessages(clientId); }}
        />
      )}
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KoreArc({ score }: { score: number | null }) {
  const r = 46, sw = 9;
  const circ = 2 * Math.PI * r;
  const pct  = score != null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const offset = circ * (1 - pct);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" strokeWidth={sw}
          stroke="rgba(255,248,236,0.10)" />
        <circle cx={55} cy={55} r={r} fill="none" strokeWidth={sw}
          stroke={score != null ? '#E7C8A0' : 'rgba(231,200,160,0.30)'}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-heading text-[28px] font-semibold text-kore-ivory leading-none">
          {score != null ? Math.round(score) : '—'}
        </p>
        <p className="font-body text-[9px] font-bold uppercase tracking-wide mt-0.5"
          style={{ color: 'rgba(231,200,160,0.60)' }}>KÓRE</p>
      </div>
    </div>
  );
}

function ModuleScoreBar({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: '#669959', yellow: '#D97706', red: '#9A0526',
    teal: '#A8C29C',  orange: '#EA580C', gray: '#9CA3AF',
  };
  const barColor = colorMap[color] ?? '#E7C8A0';
  const pct = value != null ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="font-body text-[10px] font-bold uppercase tracking-wide"
          style={{ color: 'rgba(231,200,160,0.60)' }}>{label}</p>
        <p className="font-heading text-[14px] font-semibold text-kore-ivory">
          {value != null ? `${value.toFixed(1)}${unit}` : '—'}
        </p>
      </div>
      <div className="h-1 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/65 rounded-[22px]" style={{ border: '1px solid rgba(103,15,34,0.08)' }}>
      <div className="px-4 pt-4 pb-2">
        <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase"
          style={{ color: 'rgba(103,15,34,0.55)' }}>{title}</p>
      </div>
      <div className="px-3 pb-3">{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="animate-spin h-6 w-6 border-2 rounded-full"
        style={{ borderColor: 'rgba(103,15,34,0.15)', borderTopColor: '#670F22' }} />
    </div>
  );
}

function SessionRow({
  session,
  onMessage,
}: {
  session: { id: number; status: string; package_title: string; starts_at: string | null; ends_at: string | null; notes: string; canceled_reason: string; session_notes_for_customer: string; created_at: string };
  onMessage?: (sessionId: number) => void;
}) {
  const sc = STATUS_CFG[session.status] ?? { label: session.status, bg: 'bg-gray-100', text: 'text-gray-500' };
  const date = session.starts_at
    ? new Date(session.starts_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
  const time = session.starts_at
    ? new Date(session.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';
  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors"
      style={{ ':hover': { background: 'rgba(103,15,34,0.04)' } } as React.CSSProperties}>
      <div className={`w-8 h-8 rounded-full ${sc.bg} flex items-center justify-center flex-shrink-0`}>
        <svg className={`w-4 h-4 ${sc.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          {session.status === 'confirmed'
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            : session.status === 'canceled'
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-[13px] font-semibold text-kore-wine-dark truncate">{session.package_title}</p>
        <p className="font-body text-[11px] capitalize" style={{ color: 'rgba(103,15,34,0.40)' }}>
          {date}{time ? ` · ${time}` : ''}
        </p>
      </div>
      {session.status === 'confirmed' && onMessage && (
        <button onClick={() => onMessage(session.id)}
          className="font-body text-[10px] font-bold px-2 py-1 rounded-full active:scale-95 transition-all flex-shrink-0"
          style={{ color: '#669959', background: 'rgba(168,194,156,0.18)' }}>
          Mensaje
        </button>
      )}
      <span className={`font-body text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${sc.bg} ${sc.text}`}>
        {sc.label}
      </span>
    </div>
  );
}
