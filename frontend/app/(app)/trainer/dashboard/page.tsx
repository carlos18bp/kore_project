'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import type { ClientRiskScore } from '@/lib/stores/trainerStore';
import RiskBadge from '@/app/components/trainer/RiskBadge';
import AgendaCard from '@/app/components/trainer/AgendaCard';
import RatingsSummaryCard from '@/app/components/trainer/RatingsSummaryCard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function daysAgoText(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days}d`;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

type AvatarTone = 'sage' | 'amber' | 'petal';

function TAvatar({ name, size = 36, tone = 'sage' }: { name: string; size?: number; tone?: AvatarTone }) {
  const ini = name.trim().split(/\s+/).slice(0, 2).map(s => s[0] ?? '').join('').toUpperCase() || '?';
  const bg =
    tone === 'amber' ? 'bg-gradient-to-br from-kore-gold to-kore-amber' :
    tone === 'petal' ? 'bg-gradient-to-br from-kore-petal to-kore-gold' :
    'bg-gradient-to-br from-kore-sage to-kore-sage-soft';
  return (
    <div
      className={`flex-shrink-0 rounded-full ${bg} flex items-center justify-center font-heading font-semibold text-kore-wine-dark ring-2 ring-white/60`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {ini}
    </div>
  );
}

// ── Greeting Hero ─────────────────────────────────────────────────────────────

function HoyGreeting({ name, sessionsHoy, alertasCriticas }: { name: string; sessionsHoy: number; alertasCriticas: number }) {
  const now = new Date();
  const fmtFull = now.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' });
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-8 text-kore-ivory"
      style={{ background: 'linear-gradient(135deg, #2D0F1A 0%, #4A1828 50%, #670F22 100%)' }}
    >
      <div className="pointer-events-none absolute -top-16 -right-10 h-72 w-72 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #F4C7C7, transparent 70%)', filter: 'blur(20px)' }} />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-60 w-60 rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #E7C8A0, transparent 70%)', filter: 'blur(24px)' }} />

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="font-body text-[10px] font-bold tracking-[0.28em] uppercase text-kore-gold/75 mb-2 capitalize">
            {fmtFull}
          </p>
          <h1 className="font-heading text-3xl font-semibold leading-tight mb-2 text-kore-ivory">
            {getGreeting()}, {name.split(' ')[0]}
          </h1>
          <p className="font-body text-sm max-w-lg" style={{ color: 'rgba(255,248,236,0.78)' }}>
            Hoy tienes{' '}
            <strong className="text-kore-gold">{sessionsHoy} {sessionsHoy === 1 ? 'sesión' : 'sesiones'}</strong>{' '}
            programadas
            {alertasCriticas > 0 && (
              <> y <strong className="text-kore-petal">{alertasCriticas} {alertasCriticas === 1 ? 'alerta crítica' : 'alertas críticas'}</strong> esperando tu atención</>
            )}.
          </p>
        </div>
        <div className="flex gap-2.5 flex-shrink-0">
          <Link
            href="/trainer/clients"
            prefetch={false}
            className="inline-flex items-center px-4 py-2.5 rounded-xl font-body text-xs font-semibold text-kore-ivory transition-all duration-100 active:scale-95"
            style={{ background: 'rgba(255,248,236,0.10)', border: '1px solid rgba(231,200,160,0.30)' }}
          >
            Ver clientes
          </Link>
          <Link
            href="/trainer/alerts"
            prefetch={false}
            className="inline-flex items-center px-4 py-2.5 rounded-xl font-body text-xs font-semibold text-white transition-all duration-100 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #9A0526, #AB0D2F)', boxShadow: '0 6px 16px -6px rgba(154,5,38,0.45)' }}
          >
            Atender alertas
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Top Risk List ─────────────────────────────────────────────────────────────

function TopRiskList({ clients }: { clients: ClientRiskScore[] }) {
  const top5 = useMemo(
    () => [...clients]
      .sort((a, b) => {
        const ord: Record<string, number> = { alto: 0, medio: 1, bajo: 2, sin_riesgo: 3 };
        return (ord[a.level] ?? 3) - (ord[b.level] ?? 3);
      })
      .slice(0, 5),
    [clients],
  );

  return (
    <div
      className="bg-white/65 rounded-[22px] overflow-hidden"
      style={{ border: '1px solid rgba(103,15,34,0.08)', boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)' }}
    >
      <div
        className="flex items-baseline justify-between px-6 py-5"
        style={{ borderBottom: '1px solid rgba(103,15,34,0.08)' }}
      >
        <div>
          <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: 'rgba(103,15,34,0.55)' }}>
            Top 5 · Riesgo
          </p>
          <p className="font-heading text-[18px] font-semibold text-kore-wine-dark mt-1">Clientes prioritarios</p>
        </div>
        <Link href="/trainer/clients" prefetch={false} className="font-body text-[11px] font-semibold text-kore-wine-dark hover:opacity-70 transition-opacity">
          Ver todos →
        </Link>
      </div>
      {top5.length === 0 ? (
        <p className="px-6 py-10 text-center font-body text-sm" style={{ color: 'rgba(103,15,34,0.40)' }}>Sin clientes activos</p>
      ) : (
        top5.map((c, i) => (
          <Link
            key={c.id}
            href={`/trainer/clients/client?id=${c.customer_id}`}
            prefetch={false}
            className="flex items-center gap-3.5 px-6 py-3.5 transition-colors"
            style={{
              borderBottom: i < top5.length - 1 ? '1px solid rgba(103,15,34,0.08)' : 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,199,199,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <TAvatar
              name={c.customer_name}
              size={38}
              tone={c.level === 'alto' ? 'petal' : c.level === 'medio' ? 'amber' : 'sage'}
            />
            <div className="flex-1 min-w-0">
              <p className="font-body text-[13px] font-semibold text-kore-gray-dark truncate">{c.customer_name}</p>
              <p className="font-body text-[11px] mt-0.5" style={{ color: 'rgba(103,15,34,0.55)' }}>
                {c.signals_count} señal{c.signals_count !== 1 ? 'es' : ''}
                {c.kore_score !== null && <> · KÓRE {Math.round(c.kore_score)}</>}
              </p>
            </div>
            <RiskBadge level={c.level} size="sm" />
          </Link>
        ))
      )}
    </div>
  );
}

// ── Alerts Preview ────────────────────────────────────────────────────────────

type FlatAlert = {
  clientId: number;
  clientName: string;
  type: string;
  label: string;
  severity: 'alto' | 'medio' | 'bajo';
  detail: string;
  sinceDate: string | null;
};

const SEV_PILL: Record<string, string> = {
  alto: 'bg-kore-crimson/12 text-kore-crimson border border-kore-crimson/35',
  medio: 'bg-kore-amber/20 text-kore-amber-deep border border-kore-amber/40',
  bajo: 'bg-kore-sage/15 text-kore-sage-deep border border-kore-sage/30',
};
const SEV_LABEL: Record<string, string> = { alto: 'Crítica', medio: 'Media', bajo: 'Leve' };

function HoyAlertsPreview({ alerts }: { alerts: FlatAlert[] }) {
  const top4 = alerts.slice(0, 4);
  return (
    <div
      className="bg-white/65 rounded-[22px] overflow-hidden"
      style={{ border: '1px solid rgba(103,15,34,0.08)', boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)' }}
    >
      <div
        className="flex items-baseline justify-between px-6 py-5"
        style={{ borderBottom: '1px solid rgba(103,15,34,0.08)' }}
      >
        <div>
          <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: 'rgba(103,15,34,0.55)' }}>
            Próximas alertas
          </p>
          <p className="font-heading text-[18px] font-semibold text-kore-wine-dark mt-1">
            {top4.length} {top4.length === 1 ? 'alerta' : 'alertas'} que revisar
          </p>
        </div>
        <Link href="/trainer/alerts" prefetch={false} className="font-body text-[11px] font-semibold text-kore-wine-dark hover:opacity-70 transition-opacity">
          Ir a alertas →
        </Link>
      </div>
      {top4.length === 0 ? (
        <p className="px-6 py-10 text-center font-body text-sm" style={{ color: 'rgba(103,15,34,0.40)' }}>Sin alertas abiertas</p>
      ) : (
        top4.map((a, i) => (
          <Link
            key={`${a.clientId}-${a.type}`}
            href="/trainer/alerts"
            prefetch={false}
            className="flex items-center gap-3.5 px-6 py-3.5 transition-colors"
            style={{ borderBottom: i < top4.length - 1 ? '1px solid rgba(103,15,34,0.08)' : 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,199,199,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-[0.14em] uppercase flex-shrink-0 ${SEV_PILL[a.severity] ?? SEV_PILL.bajo}`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current ${a.severity === 'alto' ? 'animate-pulse' : ''}`} />
              {SEV_LABEL[a.severity]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[13px] font-semibold text-kore-gray-dark truncate">{a.clientName}</p>
              <p className="font-body text-[11px] mt-0.5 truncate" style={{ color: 'rgba(103,15,34,0.55)' }}>
                {a.detail || a.label}
              </p>
            </div>
            {a.sinceDate && (
              <p className="font-body text-[10px] flex-shrink-0 whitespace-nowrap" style={{ color: 'rgba(103,15,34,0.40)' }}>
                {daysAgoText(a.sinceDate)}
              </p>
            )}
          </Link>
        ))
      )}
    </div>
  );
}

// ── Expired Evals ─────────────────────────────────────────────────────────────

type ExpiredEval = { customer_id: number; name: string; module: string; module_label: string; days_since: number; urgency: string };

function EvalsVencidas({ evals }: { evals: ExpiredEval[] }) {
  const items = evals.slice(0, 6);
  return (
    <div
      className="bg-white/65 rounded-[22px] overflow-hidden"
      style={{ border: '1px solid rgba(103,15,34,0.08)', boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)' }}
    >
      <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(103,15,34,0.08)' }}>
        <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: 'rgba(103,15,34,0.55)' }}>
          Evaluaciones pendientes
        </p>
        <p className="font-heading text-[18px] font-semibold text-kore-wine-dark mt-1">{evals.length} por agendar</p>
      </div>
      {items.length === 0 ? (
        <p className="px-6 py-10 text-center font-body text-sm" style={{ color: 'rgba(103,15,34,0.40)' }}>Sin evaluaciones pendientes</p>
      ) : (
        items.map((ev, i) => {
          const vencida = ev.days_since > 60;
          return (
            <div
              key={`${ev.customer_id}-${ev.module}-${i}`}
              className="flex items-center gap-3 px-6 py-3.5"
              style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(103,15,34,0.08)' : 'none' }}
            >
              <TAvatar name={ev.name} size={32} tone="sage" />
              <div className="flex-1 min-w-0">
                <p className="font-body text-[13px] font-semibold text-kore-gray-dark truncate">
                  {ev.name.split(' ').slice(0, 2).join(' ')}
                </p>
                <p className="font-body text-[10px] mt-0.5" style={{ color: 'rgba(103,15,34,0.55)' }}>
                  {ev.module_label} ·{' '}
                  <span style={{ color: vencida ? '#9A0526' : undefined, fontWeight: vencida ? 700 : undefined }}>
                    hace {ev.days_since}d
                  </span>
                </p>
              </div>
              <Link
                href={`/trainer/clients/client?id=${ev.customer_id}`}
                prefetch={false}
                className="font-body text-[11px] font-semibold flex-shrink-0 px-3 py-1.5 rounded-xl transition-all duration-100 active:scale-95 hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(103,15,34,0.10)', color: 'rgba(103,15,34,0.70)' }}
              >
                Ver cliente
              </Link>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TrainerDashboardPage() {
  const { user } = useAuthStore();
  const {
    dashboardStats, fetchDashboardStats,
    riskDashboard, fetchRiskDashboard,
    comparativeMetrics, fetchComparativeMetrics,
  } = useTrainerStore();

  useEffect(() => {
    fetchDashboardStats();
    fetchRiskDashboard();
    fetchComparativeMetrics();
  }, [fetchDashboardStats, fetchRiskDashboard, fetchComparativeMetrics]);

  const todayStr = new Date().toDateString();
  const todaySessions = useMemo(
    () => dashboardStats?.upcoming_sessions?.filter(s => new Date(s.starts_at).toDateString() === todayStr) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboardStats],
  );

  const criticalCount = riskDashboard?.risk_summary?.alto ?? 0;

  const flatAlerts: FlatAlert[] = useMemo(() => {
    const ord: Record<string, number> = { alto: 0, medio: 1, bajo: 2 };
    const out: FlatAlert[] = [];
    for (const client of riskDashboard?.clients_by_risk ?? []) {
      const resolved = new Set(client.resolutions.map(r => r.signal_type));
      for (const s of [...client.behavioral_signals, ...client.clinical_signals]) {
        if (!resolved.has(s.type)) {
          out.push({ clientId: client.customer_id, clientName: client.customer_name, type: s.type, label: s.label, severity: s.severity, detail: s.detail, sinceDate: s.since_date });
        }
      }
    }
    return out.sort((a, b) => (ord[a.severity] ?? 2) - (ord[b.severity] ?? 2));
  }, [riskDashboard]);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5">

        <HoyGreeting
          name={user.name}
          sessionsHoy={dashboardStats?.today_sessions ?? todaySessions.length}
          alertasCriticas={criticalCount}
        />

        <div className="grid xl:grid-cols-[3fr_2fr] gap-5">
          <AgendaCard />
          <TopRiskList clients={riskDashboard?.clients_by_risk ?? []} />
        </div>

        <div className="grid xl:grid-cols-[3fr_2fr] gap-5">
          <HoyAlertsPreview alerts={flatAlerts} />
          <EvalsVencidas evals={comparativeMetrics?.expired_evaluations ?? []} />
        </div>

        <RatingsSummaryCard />

      </div>
    </section>
  );
}
