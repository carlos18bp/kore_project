'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTrainerStore, type ClientRiskScore, type RiskLevel } from '@/lib/stores/trainerStore';
import TrainerBookingDialog from '@/app/components/trainer/TrainerBookingDialog';
import ResponsiveSheet from '@/app/components/trainer/ResponsiveSheet';

type FilterChip = 'all' | 'alto' | 'medio' | 'bajo' | 'eval' | 'no_session';

const RISK_CFG: Record<RiskLevel, { label: string; dot: string; bg: string; text: string }> = {
  alto:       { label: 'Riesgo alto',   dot: '#9A0526', bg: 'rgba(154,5,38,0.10)',    text: '#9A0526' },
  medio:      { label: 'Riesgo medio',  dot: '#D97706', bg: 'rgba(217,119,6,0.10)',  text: '#D97706' },
  bajo:       { label: 'Riesgo bajo',   dot: '#16A34A', bg: 'rgba(22,163,74,0.10)',   text: '#16A34A' },
  sin_riesgo: { label: 'Sin riesgo',    dot: '#9CA3AF', bg: 'rgba(156,163,175,0.10)', text: '#6B7280' },
};

const FILTER_CHIPS: [FilterChip, string][] = [
  ['all', 'Todos'],
  ['alto', 'Riesgo alto'],
  ['medio', 'Riesgo medio'],
  ['bajo', 'Riesgo bajo'],
  ['eval', 'Eval pendiente'],
  ['no_session', 'Sin sesión'],
];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function koreColor(score: number | null | undefined) {
  if (!score) return 'rgba(103,15,34,0.35)';
  if (score >= 75) return '#16A34A';
  if (score >= 50) return '#D97706';
  return '#9A0526';
}

export default function TrainerClientsPage() {
  const router = useRouter();
  const {
    clients, clientsLoading, fetchClients,
    riskDashboard, riskDashboardLoading, fetchRiskDashboard,
    comparativeMetrics, fetchComparativeMetrics,
    dashboardStats, fetchDashboardStats,
    fetchClientDetail, selectedClient,
  } = useTrainerStore();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterChip>('all');
  const [agendaTarget, setAgendaTarget] = useState<{ id: number; name: string } | null>(null);
  const [agendaLoading, setAgendaLoading] = useState(false);

  const handleAgendarClick = async (e: React.MouseEvent, client: { id: number; first_name: string; last_name: string }) => {
    e.stopPropagation();
    e.preventDefault();
    const name = `${client.first_name} ${client.last_name}`;
    setAgendaTarget({ id: client.id, name });
    setAgendaLoading(true);
    try {
      await fetchClientDetail(client.id);
    } finally {
      setAgendaLoading(false);
    }
  };

  const agendaClient = agendaTarget && selectedClient?.id === agendaTarget.id ? selectedClient : null;

  useEffect(() => {
    fetchClients();
    fetchRiskDashboard();
    fetchComparativeMetrics();
    fetchDashboardStats();
  }, [fetchClients, fetchRiskDashboard, fetchComparativeMetrics, fetchDashboardStats]);

  const riskMap = useMemo(() => {
    const m: Record<number, ClientRiskScore> = {};
    riskDashboard?.clients_by_risk.forEach(r => { m[r.customer_id] = r; });
    return m;
  }, [riskDashboard]);

  const adherenceMap = useMemo(() => {
    const m: Record<number, number> = {};
    comparativeMetrics?.adherence_ranking.forEach(a => { m[a.customer_id] = a.combined_7d; });
    return m;
  }, [comparativeMetrics]);

  const pendingEvalSet = useMemo(() => {
    const s = new Set<number>();
    comparativeMetrics?.expired_evaluations.forEach(e => s.add(e.customer_id));
    return s;
  }, [comparativeMetrics]);

  const nextSessionMap = useMemo(() => {
    const m: Record<number, { starts_at: string; package_title: string }> = {};
    dashboardStats?.upcoming_sessions
      .filter(s => new Date(s.starts_at) > new Date())
      .forEach(s => { if (!m[s.customer_id]) m[s.customer_id] = s; });
    return m;
  }, [dashboardStats]);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const q = search.toLowerCase();
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      if (search.trim() && !name.includes(q) && !c.email.toLowerCase().includes(q)) return false;
      const risk = riskMap[c.id];
      if (filter === 'alto')       return risk?.level === 'alto';
      if (filter === 'medio')      return risk?.level === 'medio';
      if (filter === 'bajo')       return risk?.level === 'bajo';
      if (filter === 'eval')       return pendingEvalSet.has(c.id);
      if (filter === 'no_session') return !nextSessionMap[c.id];
      return true;
    });
  }, [clients, search, filter, riskMap, pendingEvalSet, nextSessionMap]);

  const isLoading = clientsLoading || riskDashboardLoading;

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5">

        {/* Header */}
        <div>
          <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase mb-1"
            style={{ color: 'rgba(103,15,34,0.55)' }}>Gestión</p>
          <h1 className="font-heading text-[26px] font-semibold text-kore-wine-dark">Mis Clientes</h1>
        </div>

        {/* Search + Filter chips */}
        <div className="space-y-3">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'rgba(103,15,34,0.35)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/70 rounded-[14px] font-body text-[13px] text-kore-wine-dark placeholder:text-kore-wine-dark/30 focus:outline-none"
              style={{ border: '1px solid rgba(103,15,34,0.10)' }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full font-body text-[12px] font-semibold transition-all active:scale-95 duration-100"
                style={filter === id ? {
                  background: 'linear-gradient(135deg, #670F22, #9A0526)',
                  color: '#FFF8EC',
                } : {
                  background: 'rgba(255,255,255,0.70)',
                  color: 'rgba(103,15,34,0.60)',
                  border: '1px solid rgba(103,15,34,0.12)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        {!isLoading && (
          <p className="font-body text-[11px]" style={{ color: 'rgba(103,15,34,0.45)' }}>
            {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-7 w-7 border-2 rounded-full"
              style={{ borderColor: 'rgba(103,15,34,0.15)', borderTopColor: '#670F22' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/65 rounded-[22px] p-10 text-center"
            style={{ border: '1px solid rgba(103,15,34,0.08)' }}>
            <p className="font-body text-[13px]" style={{ color: 'rgba(103,15,34,0.45)' }}>
              {search || filter !== 'all' ? 'Sin resultados para ese filtro.' : 'Aún no tienes clientes asignados.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile cards ── */}
            <div className="xl:hidden space-y-3">
              {filtered.map(c => {
                const risk = riskMap[c.id];
                const adh  = adherenceMap[c.id];
                const nextS = nextSessionMap[c.id];
                const hasPendingEval = pendingEvalSet.has(c.id);
                const rc = risk ? RISK_CFG[risk.level] : null;
                const score = risk?.kore_score;

                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/trainer/clients/client?id=${c.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/trainer/clients/client?id=${c.id}`);
                      }
                    }}
                    className="w-full text-left bg-white/65 rounded-[22px] p-4 active:scale-[0.98] transition-transform duration-100 cursor-pointer"
                    style={{ border: '1px solid rgba(103,15,34,0.08)', boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)' }}
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #F4C7C7, #E7C8A0)' }}>
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <span className="font-heading text-sm font-bold" style={{ color: '#2D0F1A' }}>{initials(`${c.first_name} ${c.last_name}`)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading text-[15px] font-semibold text-kore-wine-dark truncate">
                          {c.first_name} {c.last_name}
                        </p>
                        <p className="font-body text-[11px] truncate" style={{ color: 'rgba(103,15,34,0.45)' }}>
                          {c.active_package ?? 'Sin programa'}
                        </p>
                        <button
                          onClick={(e) => handleAgendarClick(e, c)}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-body text-[10px] font-bold transition-colors active:scale-95"
                          style={{ color: '#670F22', background: 'rgba(103,15,34,0.08)' }}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Agendar
                        </button>
                      </div>
                      {rc && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full font-body text-[10px] font-bold"
                          style={{ background: rc.bg, color: rc.text }}>{rc.label}</span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-3 text-center">
                      <Stat value={score != null ? String(Math.round(score)) : '—'} label="KÓRE"
                        color={koreColor(score)} />
                      <Stat value={adh != null ? `${Math.round(adh * 100)}%` : '—'} label="Adher." />
                      <Stat value={`${c.completed_sessions}/${c.total_sessions}`} label="Sesiones" />
                      {hasPendingEval && <Stat value="!" label="Eval" color="#D97706" />}
                    </div>

                    {/* Next session */}
                    {nextS && (
                      <div className="mt-2 pt-2 flex items-center gap-1.5"
                        style={{ borderTop: '1px solid rgba(103,15,34,0.07)' }}>
                        <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(103,15,34,0.35)' }}
                          fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                        </svg>
                        <p className="font-body text-[11px]" style={{ color: 'rgba(103,15,34,0.50)' }}>
                          Próx.:{' '}
                          {new Date(nextS.starts_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                          {' · '}
                          {new Date(nextS.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden xl:block bg-white/65 rounded-[22px] overflow-hidden"
              style={{ border: '1px solid rgba(103,15,34,0.08)' }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px]">
                  <thead>
                    <tr style={{ background: 'rgba(103,15,34,0.04)', borderBottom: '1px solid rgba(103,15,34,0.08)' }}>
                      {['Cliente', 'Programa', 'KÓRE', 'Adherencia 7d', 'Sesiones', 'Próxima sesión', 'Última sesión', 'Estado', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-body text-[10px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: 'rgba(103,15,34,0.45)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => {
                      const risk = riskMap[c.id];
                      const adh  = adherenceMap[c.id];
                      const nextS = nextSessionMap[c.id];
                      const hasPendingEval = pendingEvalSet.has(c.id);
                      const rc = risk ? RISK_CFG[risk.level] : null;
                      const score = risk?.kore_score;

                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-kore-cream/50 transition-colors cursor-pointer"
                          style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(103,15,34,0.06)' : 'none' }}
                          onClick={() => router.push(`/trainer/clients/client?id=${c.id}`)}
                        >
                          {/* Cliente */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, #F4C7C7, #E7C8A0)' }}>
                                {c.avatar_url
                                  ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                                  : <span className="font-heading text-[11px] font-bold" style={{ color: '#2D0F1A' }}>{initials(`${c.first_name} ${c.last_name}`)}</span>}
                              </div>
                              <div className="min-w-0">
                                <p className="font-body text-[13px] font-semibold text-kore-wine-dark truncate max-w-[150px]">
                                  {c.first_name} {c.last_name}
                                </p>
                                <p className="font-body text-[11px] truncate max-w-[150px]"
                                  style={{ color: 'rgba(103,15,34,0.40)' }}>{c.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Programa */}
                          <td className="px-4 py-3">
                            <p className="font-body text-[12px] font-semibold text-kore-wine-dark truncate max-w-[130px]">
                              {c.active_package ?? '—'}
                            </p>
                          </td>

                          {/* KÓRE */}
                          <td className="px-4 py-3">
                            <p className="font-heading text-[20px] font-semibold leading-none"
                              style={{ color: koreColor(score) }}>
                              {score != null ? Math.round(score) : '—'}
                            </p>
                          </td>

                          {/* Adherencia */}
                          <td className="px-4 py-3">
                            {adh != null ? (
                              <div>
                                <p className="font-body text-[13px] font-semibold text-kore-wine-dark">
                                  {Math.round(adh * 100)}%
                                </p>
                                <div className="w-16 h-1 rounded-full mt-1"
                                  style={{ background: 'rgba(103,15,34,0.10)' }}>
                                  <div className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${adh * 100}%`,
                                      background: adh >= 0.7 ? '#16A34A' : adh >= 0.4 ? '#D97706' : '#9A0526',
                                    }} />
                                </div>
                              </div>
                            ) : (
                              <span className="font-body text-[13px]" style={{ color: 'rgba(103,15,34,0.30)' }}>—</span>
                            )}
                          </td>

                          {/* Sesiones */}
                          <td className="px-4 py-3">
                            <p className="font-body text-[13px] font-semibold text-kore-wine-dark">
                              {c.completed_sessions}
                              <span className="font-normal" style={{ color: 'rgba(103,15,34,0.40)' }}>/{c.total_sessions}</span>
                            </p>
                            {hasPendingEval && (
                              <span className="font-body text-[10px] font-semibold" style={{ color: '#D97706' }}>
                                Eval pendiente
                              </span>
                            )}
                          </td>

                          {/* Próxima sesión */}
                          <td className="px-4 py-3">
                            {nextS ? (
                              <div>
                                <p className="font-body text-[12px] text-kore-wine-dark">
                                  {new Date(nextS.starts_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                </p>
                                <p className="font-body text-[11px]" style={{ color: 'rgba(103,15,34,0.40)' }}>
                                  {new Date(nextS.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </p>
                              </div>
                            ) : (
                              <span className="font-body text-[12px]" style={{ color: 'rgba(103,15,34,0.30)' }}>Sin agendar</span>
                            )}
                          </td>

                          {/* Última sesión */}
                          <td className="px-4 py-3">
                            {c.last_session_date ? (
                              <p className="font-body text-[12px] text-kore-wine-dark">
                                {new Date(c.last_session_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </p>
                            ) : (
                              <span className="font-body text-[12px]" style={{ color: 'rgba(103,15,34,0.30)' }}>—</span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3">
                            {rc ? (
                              <span className="px-2.5 py-1 rounded-full font-body text-[10px] font-bold"
                                style={{ background: rc.bg, color: rc.text }}>{rc.label}</span>
                            ) : (
                              <span className="font-body text-[11px]" style={{ color: 'rgba(103,15,34,0.30)' }}>—</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => handleAgendarClick(e, c)}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-[10px] font-bold transition-colors active:scale-95"
                                style={{ color: '#670F22', background: 'rgba(103,15,34,0.08)' }}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Agendar
                              </button>
                              <svg className="w-4 h-4" style={{ color: 'rgba(103,15,34,0.25)' }}
                                fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Quick-action booking dialog (lazy-fetched client detail) ── */}
      {agendaTarget && agendaLoading && !agendaClient && (
        <ResponsiveSheet onClose={() => setAgendaTarget(null)}>
          <div className="px-5 py-8 flex flex-col items-center gap-3">
            <div className="animate-spin h-6 w-6 border-2 rounded-full"
              style={{ borderColor: 'rgba(103,15,34,0.15)', borderTopColor: '#670F22' }} />
            <p className="font-body text-[12px] text-kore-wine-dark/55">Cargando datos del cliente…</p>
          </div>
        </ResponsiveSheet>
      )}
      {agendaTarget && agendaClient && agendaClient.subscription && (
        <TrainerBookingDialog
          mode="create"
          customerId={agendaTarget.id}
          customerName={agendaTarget.name}
          packageId={agendaClient.subscription.package_id}
          subscriptionId={agendaClient.subscription.id}
          onClose={() => setAgendaTarget(null)}
          onSuccess={() => { fetchDashboardStats(); }}
        />
      )}
      {agendaTarget && agendaClient && !agendaClient.subscription && (
        <ResponsiveSheet onClose={() => setAgendaTarget(null)}>
          <div className="px-5 py-6 space-y-3">
            <p className="font-heading text-[16px] font-semibold text-kore-wine-dark">No se puede agendar</p>
            <p className="font-body text-[13px] text-kore-wine-dark/55">
              {agendaTarget.name} no tiene un plan activo. Pídele que adquiera una suscripción antes de agendar sesiones.
            </p>
            <button
              onClick={() => setAgendaTarget(null)}
              className="w-full bg-kore-red text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-kore-red-dark transition-colors"
            >
              Entendido
            </button>
          </div>
        </ResponsiveSheet>
      )}
    </section>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="font-heading text-[18px] font-semibold leading-none"
        style={{ color: color ?? '#670F22' }}>{value}</p>
      <p className="font-body text-[9px] font-bold uppercase tracking-wide mt-0.5"
        style={{ color: 'rgba(103,15,34,0.45)' }}>{label}</p>
    </div>
  );
}
