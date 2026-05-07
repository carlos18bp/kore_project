'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useBookingStore, type BookingData, type Subscription } from '@/lib/stores/bookingStore';
import SessionDetailModal from '@/app/components/booking/SessionDetailModal';
import { WHATSAPP_URL } from '@/lib/constants';

/* ──────────────────────────────────────────────────────────────────────────
 *  Constants
 *  ────────────────────────────────────────────────────────────────────── */

const KORE = {
  wineDark: '#670F22',
  ivory: '#FFF8EC',
  cream: '#FFE9DC',
  gold: '#E7C8A0',
  sage: '#A8C29C',
  sageDeep: '#669959',
  amber: '#E5C97A',
  amberDeep: '#A88A2E',
  sakura: '#F4C7C7',
  sakuraDeep: '#E4A8A8',
  green: '#1F6B4A',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  expired: 'Expirada',
  canceled: 'Cancelada',
};

const HERO_KEYFRAMES = `
  @keyframes sub-mist-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(50px,-40px) scale(1.1); } }
  @keyframes sub-mist-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,40px) scale(1.05); } }
  @keyframes sub-petal-a { 0%,100% { transform: translate(0,0) rotate(0deg); } 33% { transform: translate(8px,-12px) rotate(8deg); } 66% { transform: translate(-6px,-6px) rotate(-5deg); } }
  @keyframes sub-petal-b { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-10px,12px) rotate(-12deg); } }
`;

const formatPrice = (price: string, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(price));

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateLong = (iso: string | null | undefined) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};

const benefitsForSubscription = (sub: Subscription): string[] => {
  const sessionsLabel = `${sub.package.sessions_count} ${sub.package.sessions_count === 1 ? 'sesión presencial' : 'sesiones presenciales'} con tu trainer asignado`;
  return [
    sessionsLabel,
    'Plan de entrenamiento personalizado',
    'Plan nutricional con seguimiento semanal',
    'Evaluaciones físicas y de postura incluidas',
    'Acceso a Mi Progreso y reportes mensuales',
  ];
};

/* ──────────────────────────────────────────────────────────────────────────
 *  Atom components
 *  ────────────────────────────────────────────────────────────────────── */

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 80;
  const cw = 200;
  const C = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="relative" style={{ width: cw, height: cw }}>
      <div
        className="absolute pointer-events-none"
        style={{
          inset: -20, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,233,220,0.15) 0%, rgba(244,199,199,0.06) 50%, transparent 75%)',
          filter: 'blur(20px)',
        }}
      />
      <svg
        width={cw} height={cw}
        style={{ transform: 'rotate(-90deg)', position: 'relative', filter: 'drop-shadow(0 8px 24px rgba(244,199,199,0.18))' }}
      >
        <defs>
          <linearGradient id="sub-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={KORE.cream} />
            <stop offset="50%" stopColor={KORE.gold} />
            <stop offset="100%" stopColor="#C9A77A" />
          </linearGradient>
        </defs>
        <circle cx={cw / 2} cy={cw / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        <circle
          cx={cw / 2} cy={cw / 2} r={r}
          fill="none" stroke="url(#sub-ring-grad)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.24em', color: KORE.gold }}>Avance</span>
        <span
          className="font-heading font-semibold leading-none mt-1"
          style={{ color: KORE.ivory, fontSize: 52, letterSpacing: '-0.015em', textShadow: '0 2px 16px rgba(244,199,199,0.18)' }}
        >
          {Math.round(pct * 100)}<span className="text-[24px]">%</span>
        </span>
        <span className="text-[11px] mt-1.5 font-medium" style={{ color: KORE.gold, opacity: 0.9 }}>
          {done} / {total} sesiones
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Hero
 *  ────────────────────────────────────────────────────────────────────── */

function Hero({ sub }: { sub: Subscription }) {
  const isActive = sub.status === 'active';
  const statusChipColor = isActive ? KORE.sage : sub.status === 'expired' ? KORE.amber : KORE.sakuraDeep;
  const statusLabel = STATUS_LABEL[sub.status] ?? sub.status;

  return (
    <div
      className="relative overflow-hidden text-white"
      style={{
        borderRadius: 32,
        background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
        padding: 'clamp(24px, 4vw, 56px)',
        boxShadow: '0 30px 70px -25px rgba(45,15,26,0.55), inset 0 1px 0 rgba(255,233,220,0.12), 0 0 0 1px rgba(231,200,160,0.10)',
      }}
    >
      <div className="absolute pointer-events-none" style={{ top: '-20%', right: '-12%', width: 580, height: 580, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,233,220,0.20) 0%, rgba(244,199,199,0.10) 40%, transparent 65%)', filter: 'blur(80px)', animation: 'sub-mist-a 22s ease-in-out infinite' }} />
      <div className="absolute pointer-events-none" style={{ bottom: '-25%', left: '-15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,5,12,0.65) 0%, transparent 65%)', filter: 'blur(90px)', animation: 'sub-mist-b 26s ease-in-out infinite' }} />
      <svg style={{ position: 'absolute', top: 28, right: 80, width: 28, height: 28, opacity: 0.55, animation: 'sub-petal-a 14s ease-in-out infinite', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.sakura} opacity="0.9" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 70, right: 320, width: 22, height: 22, opacity: 0.45, animation: 'sub-petal-b 20s ease-in-out infinite reverse', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.gold} opacity="0.85" />
      </svg>
      <div className="absolute pointer-events-none" style={{ top: 0, left: 32, right: 32, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(231,200,160,0.5) 50%, transparent 100%)' }} />
      <svg className="absolute pointer-events-none" style={{ bottom: -40, right: -40, width: 200, height: 200, opacity: 0.06 }} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke={KORE.gold} strokeWidth="1.5" strokeDasharray="220 40" />
      </svg>

      <div className="relative grid gap-10 xl:gap-14 xl:grid-cols-[1.3fr_240px] items-center">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: KORE.gold }}>Tu plan vigente</p>
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
              style={{
                background: `${statusChipColor}33`,
                color: statusChipColor,
                border: `1px solid ${statusChipColor}66`,
                letterSpacing: '0.18em',
              }}
            >
              ● {statusLabel}
            </span>
          </div>
          <h2
            className="font-heading font-semibold leading-[1.05] mt-3.5"
            style={{ color: KORE.ivory, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.01em', textShadow: '0 2px 16px rgba(244,199,199,0.18)' }}
          >
            {sub.package.title}
          </h2>
          <p className="text-[14px] xl:text-[15px] leading-[1.7] mt-4 max-w-lg" style={{ color: KORE.cream, opacity: 0.95 }}>
            Vas{' '}
            <strong style={{ color: KORE.sage, fontWeight: 600 }}>
              {sub.sessions_used} de {sub.sessions_total} sesiones
            </strong>
            .{' '}
            {sub.next_billing_date && isActive && sub.is_recurring
              ? <>Tu próxima renovación es el <strong style={{ color: KORE.gold, fontWeight: 600 }}>{formatDateLong(sub.next_billing_date)}</strong>.</>
              : isActive
              ? <>Tu plan vence el <strong style={{ color: KORE.gold, fontWeight: 600 }}>{formatDateLong(sub.expires_at)}</strong>.</>
              : <>Plan {statusLabel.toLowerCase()} desde el <strong style={{ color: KORE.gold, fontWeight: 600 }}>{formatDateLong(sub.expires_at)}</strong>.</>}
          </p>

          <div className="grid grid-cols-3 gap-3 mt-7">
            <div style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.20)' }}>
              <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: KORE.gold }}>Precio</p>
              <p className="font-heading text-[22px] font-semibold mt-1.5" style={{ color: KORE.ivory, letterSpacing: '-0.005em' }}>
                {formatPrice(sub.package.price, sub.package.currency)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'rgba(255,233,220,0.65)' }}>
                {sub.is_recurring ? 'Mensual' : `${sub.package.validity_days || 30} días`}
              </p>
            </div>
            <div style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.20)' }}>
              <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: KORE.gold }}>Inicio</p>
              <p className="font-heading text-[16px] font-semibold mt-1.5" style={{ color: KORE.ivory }}>{formatDateLong(sub.starts_at)}</p>
            </div>
            <div style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.20)' }}>
              <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: KORE.gold }}>{sub.is_recurring ? 'Renueva' : 'Vence'}</p>
              <p className="font-heading text-[16px] font-semibold mt-1.5" style={{ color: KORE.ivory }}>{formatDateLong(sub.expires_at)}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center xl:justify-end">
          <ProgressRing done={sub.sessions_used} total={sub.sessions_total} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Benefits + Actions row
 *  ────────────────────────────────────────────────────────────────────── */

function BenefitsCard({ sub }: { sub: Subscription }) {
  const benefits = benefitsForSubscription(sub);
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(20px, 3vw, 36px)',
        border: '1px solid rgba(103,15,34,0.08)',
        boxShadow: '0 4px 20px -12px rgba(45,15,26,0.15)',
      }}
    >
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Tu plan incluye</p>
        <h2 className="font-heading text-2xl font-semibold mt-1.5" style={{ color: KORE.wineDark }}>
          {benefits.length} beneficios activos
        </h2>
      </div>
      <div className="flex flex-col gap-2.5">
        {benefits.map((b, i) => (
          <div
            key={i}
            className="flex items-start gap-3.5"
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'rgba(168,194,156,0.06)',
              border: '1px solid rgba(168,194,156,0.18)',
            }}
          >
            <span
              className="grid place-items-center font-heading font-bold text-[12px] shrink-0"
              style={{ width: 22, height: 22, borderRadius: 11, background: 'rgba(168,194,156,0.25)', color: KORE.sageDeep }}
            >
              ✓
            </span>
            <span className="text-[13.5px] leading-[1.55]" style={{ color: '#3A2128' }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionsCard({
  sub, actionLoading, onCancel, showCancelConfirm, setShowCancelConfirm,
}: {
  sub: Subscription;
  actionLoading: boolean;
  onCancel: () => void;
  showCancelConfirm: boolean;
  setShowCancelConfirm: (v: boolean) => void;
}) {
  const isActive = sub.status === 'active';
  const billingFailed = !!sub.billing_failed_at;

  // Renew availability for non-recurring (7 days before expiry)
  const daysToExpiry = useMemo(() => {
    const d = new Date(sub.expires_at);
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [sub.expires_at]);
  const canRenewNonRecurring = !sub.is_recurring && isActive && daysToExpiry <= 7;

  return (
    <div
      className="flex flex-col gap-3.5"
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(20px, 2.5vw, 28px)',
        border: '1px solid rgba(103,15,34,0.08)',
      }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Acciones</p>
        <h2 className="font-heading text-xl font-semibold mt-1.5" style={{ color: KORE.wineDark }}>Gestiona tu plan</h2>
      </div>

      {isActive && sub.is_recurring && !billingFailed && sub.next_billing_date && (
        <div
          style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(168,194,156,0.10)', border: '1px solid rgba(168,194,156,0.30)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: 4, background: KORE.sage, boxShadow: '0 0 0 4px rgba(168,194,156,0.25)' }} />
          <span className="text-[12px] leading-[1.5]" style={{ color: '#3A2128' }}>
            Renovación automática el{' '}
            <strong style={{ color: KORE.sageDeep }}>{formatDateLong(sub.next_billing_date)}</strong>
          </span>
        </div>
      )}

      {billingFailed && (
        <div
          style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(228,168,168,0.18)', border: '1px solid rgba(228,168,168,0.40)',
          }}
        >
          <p className="text-[12px] font-semibold" style={{ color: '#9A0526' }}>Cobro fallido</p>
          <p className="text-[11.5px] leading-[1.5] mt-1" style={{ color: '#3A2128' }}>
            No pudimos procesar tu último cobro automático. Actualiza tu método de pago para mantener tu suscripción.
          </p>
        </div>
      )}

      {/* Renew CTAs */}
      {isActive && billingFailed && (
        <Link
          href={`/checkout?package=${sub.package.id}`}
          className="text-[12px] font-semibold text-white text-center active:scale-95 transition-transform"
          style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
            boxShadow: '0 6px 16px -6px rgba(154,5,38,0.45)',
            letterSpacing: '0.04em',
          }}
        >
          Actualizar pago →
        </Link>
      )}

      {isActive && !sub.is_recurring && !billingFailed && canRenewNonRecurring && (
        <Link
          href={`/checkout?package=${sub.package.id}`}
          className="text-[12px] font-semibold text-white text-center active:scale-95 transition-transform"
          style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
            boxShadow: '0 6px 16px -6px rgba(154,5,38,0.45)',
            letterSpacing: '0.04em',
          }}
        >
          Renovar suscripción →
        </Link>
      )}

      {isActive && !sub.is_recurring && !billingFailed && !canRenewNonRecurring && (
        <button
          type="button"
          disabled
          className="text-[12px] font-semibold text-center cursor-not-allowed"
          style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'rgba(103,15,34,0.04)',
            color: 'rgba(103,15,34,0.40)',
            border: '1px dashed rgba(103,15,34,0.15)',
          }}
        >
          Renovar (disponible en {daysToExpiry} días)
        </button>
      )}

      {/* Change plan / explore programs */}
      <Link
        href="/programs"
        className="text-[12px] font-semibold text-center active:scale-95 transition-transform"
        style={{
          padding: '12px 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.7)',
          color: KORE.wineDark,
          border: '1px solid rgba(103,15,34,0.15)',
        }}
      >
        Cambiar de plan →
      </Link>

      {/* Cancel */}
      {isActive && !showCancelConfirm && (
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          className="text-[11px] font-medium active:scale-95 transition-transform"
          style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'transparent',
            color: 'rgba(103,15,34,0.55)',
            border: '1px dashed rgba(103,15,34,0.25)',
          }}
        >
          Cancelar suscripción
        </button>
      )}
      {isActive && showCancelConfirm && (
        <div
          style={{
            padding: '16px 18px', borderRadius: 14,
            background: 'rgba(228,168,168,0.18)', border: '1px solid rgba(228,168,168,0.40)',
          }}
        >
          <p className="text-[13px] font-semibold" style={{ color: '#9A0526' }}>¿Seguro que deseas cancelar?</p>
          <p className="text-[11.5px] mt-1.5 leading-[1.5]" style={{ color: '#3A2128' }}>
            {sub.is_recurring
              ? 'Se detendrán los cobros automáticos. Podrás usar tus sesiones restantes hasta el vencimiento.'
              : `Podrás seguir usando tus ${sub.sessions_remaining} sesiones restantes hasta el ${formatDate(sub.expires_at)}.`}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={actionLoading}
              className="flex-1 text-[12px] font-semibold text-white active:scale-95 transition-transform disabled:opacity-60"
              style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
              }}
            >
              {actionLoading ? 'Cancelando…' : 'Sí, cancelar'}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1 text-[12px] font-semibold active:scale-95 transition-transform"
              style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(103,15,34,0.05)',
                color: KORE.wineDark,
              }}
            >
              No, volver
            </button>
          </div>
        </div>
      )}

      {/* Inactive — renew CTA */}
      {!isActive && (
        <Link
          href={`/checkout?package=${sub.package.id}`}
          className="text-[12px] font-semibold text-white text-center active:scale-95 transition-transform"
          style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
            boxShadow: '0 6px 16px -6px rgba(154,5,38,0.45)',
            letterSpacing: '0.04em',
          }}
        >
          Renovar este programa →
        </Link>
      )}

      {/* Help */}
      <div className="mt-1 pt-4" style={{ borderTop: '1px solid rgba(103,15,34,0.10)' }}>
        <p className="text-[10px] font-bold uppercase mb-2" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.55)' }}>¿Necesitas ayuda?</p>
        <p className="text-[12px] leading-[1.55] mb-3" style={{ color: 'rgba(58,33,40,0.75)' }}>
          Escríbenos para resolver dudas sobre tu suscripción.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 text-[12px] font-semibold text-white active:scale-95 transition-transform"
          style={{
            padding: '12px 16px', borderRadius: 12,
            background: KORE.green,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Escribir por WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Sessions card
 *  ────────────────────────────────────────────────────────────────────── */

function SessionsCard({
  bookings, subscriptionId, isGuest, onSelect,
}: {
  bookings: BookingData[];
  subscriptionId: number;
  isGuest: boolean;
  onSelect: (b: BookingData) => void;
}) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const subBookings = useMemo(
    () => bookings.filter((b) => b.subscription_id_display === subscriptionId),
    [bookings, subscriptionId],
  );
  const now = new Date();
  const upcoming = useMemo(
    () => subBookings
      .filter((b) => b.status !== 'canceled' && new Date(b.slot.starts_at) > now)
      .sort((a, b) => new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime()),
    [subBookings, now],
  );
  const past = useMemo(
    () => subBookings
      .filter((b) => b.status === 'canceled' || new Date(b.slot.starts_at) <= now)
      .sort((a, b) => new Date(b.slot.starts_at).getTime() - new Date(a.slot.starts_at).getTime()),
    [subBookings, now],
  );

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(20px, 3vw, 36px)',
        border: '1px solid rgba(103,15,34,0.08)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Tus citas</p>
          <h2 className="font-heading text-2xl font-semibold mt-1.5" style={{ color: KORE.wineDark }}>Mis sesiones</h2>
        </div>
        {!isGuest && (
          <Link
            href="/book-session"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white active:scale-95 transition-transform"
            style={{
              padding: '10px 16px', borderRadius: 11,
              background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
              boxShadow: '0 4px 12px -4px rgba(154,5,38,0.4)',
            }}
          >
            + Agendar
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div
        className="grid grid-cols-2 gap-1 mb-4 p-1"
        style={{ background: 'rgba(103,15,34,0.05)', borderRadius: 12 }}
      >
        {([
          { k: 'upcoming' as const, l: `Próximas (${upcoming.length})` },
          { k: 'past' as const, l: `Pasadas (${past.length})` },
        ]).map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className="text-[12px] transition-all"
              style={{
                padding: '10px 14px',
                borderRadius: 9,
                background: active ? KORE.ivory : 'transparent',
                color: active ? KORE.wineDark : 'rgba(103,15,34,0.55)',
                border: 'none',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                boxShadow: active ? '0 2px 6px -2px rgba(45,15,26,0.10)' : 'none',
              }}
            >
              {t.l}
            </button>
          );
        })}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="text-center text-[13px] italic py-8" style={{ color: 'rgba(103,15,34,0.50)' }}>
          {tab === 'upcoming' ? 'No tienes sesiones próximas en este ciclo.' : 'Aún no tienes sesiones pasadas en este ciclo.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.slice(0, 6).map((booking) => {
            const d = new Date(booking.slot.starts_at);
            const dateStr = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
            const trainerName = booking.trainer ? `${booking.trainer.first_name} ${booking.trainer.last_name}` : '';
            const ok = booking.status === 'confirmed';
            const isCanceled = booking.status === 'canceled';
            const statusColor = ok ? KORE.sageDeep : isCanceled ? KORE.sakuraDeep : KORE.amberDeep;
            const statusBg = ok ? 'rgba(168,194,156,0.20)' : isCanceled ? 'rgba(228,168,168,0.20)' : 'rgba(229,201,122,0.22)';
            const statusBorder = ok ? 'rgba(168,194,156,0.40)' : isCanceled ? 'rgba(228,168,168,0.40)' : 'rgba(229,201,122,0.42)';
            const statusLabel = ok ? 'Confirmada' : isCanceled ? 'Cancelada' : 'Pendiente';

            return (
              <button
                key={booking.id}
                type="button"
                onClick={() => onSelect(booking)}
                data-testid={`subscription-session-row-${booking.id}`}
                className="grid items-center gap-3 text-left active:scale-[0.99] transition-transform"
                style={{
                  gridTemplateColumns: '44px 1fr auto',
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(103,15,34,0.06)',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="grid place-items-center"
                  style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(244,199,199,0.30), rgba(231,200,160,0.18))',
                    border: '1px solid rgba(103,15,34,0.10)',
                    color: '#9A0526',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 9h18M8 3v4M16 3v4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-heading text-[15px] font-semibold capitalize" style={{ color: KORE.wineDark }}>
                    {dateStr} · <span style={{ color: '#9A0526' }}>{timeStr}</span>
                  </p>
                  {trainerName && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(103,15,34,0.55)' }}>{trainerName}</p>
                  )}
                </div>
                <span
                  className="text-[10px] font-bold uppercase shrink-0"
                  style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: statusBg,
                    color: statusColor,
                    border: `1px solid ${statusBorder}`,
                    letterSpacing: '0.10em',
                  }}
                >
                  ● {statusLabel}
                </span>
              </button>
            );
          })}
          {list.length > 6 && (
            <p className="text-[11px] text-center pt-1" style={{ color: 'rgba(103,15,34,0.45)' }}>
              {list.length - 6} sesiones más
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Payments card (no receipt button)
 *  ────────────────────────────────────────────────────────────────────── */

function PaymentsCard({ payments }: { payments: { id: number; amount: string; currency: string; status: string; created_at: string }[] }) {
  if (!payments || payments.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(255,255,255,0.65)',
          borderRadius: 28,
          padding: 'clamp(20px, 3vw, 36px)',
          border: '1px solid rgba(103,15,34,0.08)',
        }}
      >
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Tus cobros</p>
          <h2 className="font-heading text-2xl font-semibold mt-1.5" style={{ color: KORE.wineDark }}>Historial de pagos</h2>
        </div>
        <p className="text-center text-[13px] italic py-6" style={{ color: 'rgba(103,15,34,0.50)' }}>Sin pagos registrados.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(20px, 3vw, 36px)',
        border: '1px solid rgba(103,15,34,0.08)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Tus cobros</p>
          <h2 className="font-heading text-2xl font-semibold mt-1.5" style={{ color: KORE.wineDark }}>Historial de pagos</h2>
        </div>
        <span className="text-[11px]" style={{ color: 'rgba(103,15,34,0.55)' }}>
          {payments.length} {payments.length === 1 ? 'cobro' : 'cobros'}
        </span>
      </div>
      <div className="flex flex-col">
        {payments.map((p, i) => {
          const ok = p.status === 'confirmed';
          const isPending = p.status === 'pending';
          const statusColor = ok ? KORE.sageDeep : isPending ? KORE.amberDeep : KORE.sakuraDeep;
          const statusBg = ok ? 'rgba(168,194,156,0.20)' : isPending ? 'rgba(229,201,122,0.22)' : 'rgba(228,168,168,0.20)';
          const statusBorder = ok ? 'rgba(168,194,156,0.40)' : isPending ? 'rgba(229,201,122,0.42)' : 'rgba(228,168,168,0.40)';
          const statusLabel = ok ? 'Confirmado' : isPending ? 'Pendiente' : 'Fallido';
          return (
            <div
              key={p.id}
              className="grid items-center gap-4 py-4 flex-wrap"
              style={{
                gridTemplateColumns: 'minmax(140px, 160px) 1fr auto',
                borderTop: i === 0 ? 'none' : '1px solid rgba(103,15,34,0.08)',
              }}
            >
              <div>
                <p className="font-heading text-[14px] font-semibold" style={{ color: KORE.wineDark }}>{formatDateLong(p.created_at)}</p>
                <p className="text-[10px] mt-0.5 capitalize" style={{ color: 'rgba(103,15,34,0.55)' }}>
                  {p.status === 'confirmed' ? 'Pago confirmado' : p.status === 'pending' ? 'Procesándose' : 'Falló el cobro'}
                </p>
              </div>
              <span className="font-heading text-[16px] font-semibold tabular-nums" style={{ color: KORE.wineDark }}>
                {formatPrice(p.amount, p.currency)}
              </span>
              <span
                className="text-[10px] font-bold uppercase shrink-0"
                style={{
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: statusBg,
                  color: statusColor,
                  border: `1px solid ${statusBorder}`,
                  letterSpacing: '0.10em',
                }}
              >
                ● {statusLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Guest invite card (only for duo plan host)
 *  ────────────────────────────────────────────────────────────────────── */

function GuestCard({
  sub, actionLoading, error, guestEmail, setGuestEmail, onInvite, onRevoke,
}: {
  sub: Subscription;
  actionLoading: boolean;
  error: string;
  guestEmail: string;
  setGuestEmail: (s: string) => void;
  onInvite: () => void;
  onRevoke: () => void;
}) {
  const guestInfo = sub.guest_info;
  const status = guestInfo?.status;
  const showInviteForm = !guestInfo || status === 'revoked';
  const showPending = status === 'pending';
  const showAccepted = status === 'accepted';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(20px, 3vw, 28px)',
        border: '1px solid rgba(103,15,34,0.08)',
      }}
    >
      <h3 className="font-heading text-base font-semibold flex items-center gap-2" style={{ color: KORE.wineDark }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ color: '#9A0526' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        Compañero/a de entrenamiento
      </h3>

      {showInviteForm && (
        <div className="mt-3 flex flex-col gap-2.5">
          <p className="text-[12px]" style={{ color: 'rgba(103,15,34,0.55)' }}>
            Ingresa el correo de tu compañero/a para invitarlo a entrenar juntos.
          </p>
          {error && <p className="text-[12px] font-semibold" style={{ color: '#9A0526' }}>{error}</p>}
          <input
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="text-[13px]"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(103,15,34,0.12)',
              color: '#3A2128',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={onInvite}
            disabled={actionLoading || !guestEmail}
            className="text-[12px] font-semibold text-white active:scale-95 transition-transform disabled:opacity-50"
            style={{
              padding: '11px 16px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
            }}
          >
            {actionLoading ? 'Enviando…' : 'Invitar compañero/a'}
          </button>
        </div>
      )}

      {showPending && guestInfo && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(229,201,122,0.18)',
              border: '1px solid rgba(229,201,122,0.42)',
            }}
          >
            <p className="text-[12px] leading-[1.5]" style={{ color: '#3A2128' }}>
              Invitación enviada a <strong style={{ color: KORE.wineDark }}>{guestInfo.invited_email}</strong>. Esperando aceptación.
            </p>
          </div>
          <button
            type="button"
            onClick={onRevoke}
            disabled={actionLoading}
            className="text-[12px] font-semibold active:scale-95 transition-transform disabled:opacity-50"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(228,168,168,0.18)',
              border: '1px solid rgba(228,168,168,0.40)',
              color: '#9A0526',
            }}
          >
            Revocar invitación
          </button>
        </div>
      )}

      {showAccepted && guestInfo && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(168,194,156,0.18)',
              border: '1px solid rgba(168,194,156,0.40)',
            }}
          >
            <p className="text-[12px] leading-[1.5]" style={{ color: '#3A2128' }}>
              <strong style={{ color: KORE.sageDeep }}>{guestInfo.guest_name ?? guestInfo.invited_email}</strong> es tu compañero/a activo/a.
            </p>
          </div>
          <button
            type="button"
            onClick={onRevoke}
            disabled={actionLoading}
            className="text-[12px] font-semibold active:scale-95 transition-transform disabled:opacity-50"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(228,168,168,0.18)',
              border: '1px solid rgba(228,168,168,0.40)',
              color: '#9A0526',
            }}
          >
            Revocar acceso
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Main page
 *  ────────────────────────────────────────────────────────────────────── */

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const {
    subscriptions,
    activeSubscription,
    hasOwnActiveSubscription,
    pendingInvitation,
    fetchPendingInvitation,
    acceptPendingInvitation,
    selectedSubscriptionId,
    payments,
    loading,
    actionLoading,
    error,
    fetchSubscriptions,
    setSelectedSubscriptionId,
    cancelSubscription,
    fetchPaymentHistory,
    inviteGuest,
    revokeGuest,
  } = useSubscriptionStore();

  const { bookings, fetchBookings } = useBookingStore();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [sessionModalBooking, setSessionModalBooking] = useState<BookingData | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestError, setGuestError] = useState('');
  const [inviteAccepting, setInviteAccepting] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState<{ host_name: string; package_title: string } | null>(null);

  useEffect(() => {
    fetchSubscriptions();
    fetchBookings();
    fetchPendingInvitation();
  }, [fetchSubscriptions, fetchBookings, fetchPendingInvitation]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status === 'active'),
    [subscriptions],
  );
  const inactiveSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status !== 'active'),
    [subscriptions],
  );

  const selectedSubscription = useMemo(() => {
    if (!selectedSubscriptionId) return null;
    return subscriptions.find((s) => s.id === selectedSubscriptionId) ?? null;
  }, [selectedSubscriptionId, subscriptions]);

  useEffect(() => {
    if (subscriptions.length === 0) {
      setSelectedSubscriptionId(null);
      return;
    }
    const stillExists = selectedSubscriptionId
      ? subscriptions.some((s) => s.id === selectedSubscriptionId)
      : false;
    if (stillExists) return;
    const fallback = activeSubscriptions[0] ?? inactiveSubscriptions[0];
    setSelectedSubscriptionId(fallback?.id ?? null);
  }, [activeSubscriptions, inactiveSubscriptions, selectedSubscriptionId, subscriptions, setSelectedSubscriptionId]);

  useEffect(() => {
    if (selectedSubscription) {
      fetchPaymentHistory(selectedSubscription.id);
      setShowCancelConfirm(false);
    }
  }, [selectedSubscription, fetchPaymentHistory]);

  const detailSubscription = selectedSubscription ?? activeSubscription ?? null;

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" role="status" aria-label="Cargando" />
      </section>
    );
  }

  const headerCaption = (() => {
    if (!detailSubscription) return 'Mi cuenta';
    const start = formatDate(detailSubscription.starts_at);
    const end = formatDate(detailSubscription.expires_at);
    return `Plan ${STATUS_LABEL[detailSubscription.status]?.toLowerCase() ?? ''} · Ciclo del ${start} al ${end}`;
  })();

  const handleInviteGuest = async () => {
    if (!detailSubscription) return;
    setGuestError('');
    const result = await inviteGuest(detailSubscription.id, guestEmail);
    if (result.success) {
      setGuestEmail('');
    } else {
      setGuestError(result.error ?? 'No se pudo enviar la invitación.');
    }
  };

  const handleRevokeGuest = async () => {
    if (!detailSubscription) return;
    await revokeGuest(detailSubscription.id);
  };

  const handleCancelConfirm = async () => {
    if (!detailSubscription) return;
    await cancelSubscription(detailSubscription.id);
    setShowCancelConfirm(false);
  };

  return (
    <section className="min-h-screen bg-kore-cream">
      <style>{HERO_KEYFRAMES}</style>
      <div className="px-5 xl:px-10 pt-6 xl:pt-10 pb-20 mx-auto" style={{ maxWidth: 1280 }}>
        {/* HEADER */}
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Mi cuenta</p>
          <h1
            className="font-heading text-3xl xl:text-4xl font-semibold mt-2 leading-tight"
            style={{ color: KORE.wineDark, letterSpacing: '-0.015em' }}
          >
            Mi Suscripción
          </h1>
          <p className="text-[13px] text-kore-gray-dark/60 mt-1.5">{headerCaption}</p>
        </div>

        {/* Pending invitation banner */}
        {inviteAccepted ? (
          <div
            className="mb-6 flex items-start gap-3"
            style={{
              padding: 18,
              borderRadius: 18,
              background: 'rgba(168,194,156,0.12)',
              border: '1px solid rgba(168,194,156,0.40)',
            }}
          >
            <span
              className="grid place-items-center font-bold text-[14px] shrink-0"
              style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(168,194,156,0.25)', color: KORE.sageDeep }}
            >
              ✓
            </span>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: KORE.sageDeep }}>¡Invitación aceptada!</p>
              <p className="text-[12px] mt-0.5 leading-[1.5]" style={{ color: '#3A2128' }}>
                Ahora entrenas en el plan <strong>{inviteAccepted.package_title}</strong> junto a <strong>{inviteAccepted.host_name}</strong>.
              </p>
            </div>
          </div>
        ) : pendingInvitation ? (
          <div
            className="mb-6"
            style={{
              padding: 18,
              borderRadius: 18,
              background: 'rgba(229,201,122,0.10)',
              border: '1px solid rgba(229,201,122,0.42)',
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="grid place-items-center text-[14px] shrink-0"
                style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(229,201,122,0.28)', color: KORE.amberDeep }}
              >
                ✉
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold" style={{ color: KORE.wineDark }}>Tienes una invitación pendiente</p>
                <p className="text-[12px] mt-1 leading-[1.5]" style={{ color: '#3A2128' }}>
                  <strong>{pendingInvitation.host_name}</strong> te invita a entrenar en el plan <strong>{pendingInvitation.package_title}</strong>.
                </p>
                <button
                  type="button"
                  disabled={inviteAccepting}
                  onClick={async () => {
                    setInviteAccepting(true);
                    const result = await acceptPendingInvitation();
                    setInviteAccepting(false);
                    if (result.success && result.host_name && result.package_title) {
                      setInviteAccepted({ host_name: result.host_name, package_title: result.package_title });
                    }
                  }}
                  className="mt-3 text-[12px] font-semibold text-white active:scale-95 transition-transform disabled:opacity-60"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
                  }}
                >
                  {inviteAccepting ? 'Aceptando…' : 'Aceptar invitación'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Error banner */}
        {error && (
          <div
            className="mb-6"
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(228,168,168,0.18)',
              border: '1px solid rgba(228,168,168,0.40)',
              color: '#9A0526',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && subscriptions.length === 0 && (
          <div className="flex justify-center py-24">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" role="status" aria-label="Cargando" />
          </div>
        )}

        {/* No subscription */}
        {!loading && subscriptions.length === 0 && (
          <div
            className="mt-4 mx-auto text-center max-w-xl"
            style={{
              padding: 'clamp(28px, 4vw, 40px)',
              borderRadius: 24,
              background: 'rgba(255,255,255,0.78)',
              border: '1px solid rgba(103,15,34,0.08)',
              boxShadow: '0 4px 20px -12px rgba(45,15,26,0.15)',
            }}
          >
            <div
              className="w-14 h-14 mx-auto mb-4 rounded-full grid place-items-center text-2xl"
              style={{ background: 'rgba(103,15,34,0.06)' }}
            >
              📅
            </div>
            <h2 className="font-heading text-xl font-semibold" style={{ color: KORE.wineDark }}>Sin suscripción activa</h2>
            <p className="text-[13px] mt-2 leading-[1.55]" style={{ color: 'rgba(103,15,34,0.65)' }}>
              Explora nuestros programas y comienza tu transformación.
            </p>
            <Link
              href="/programs"
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-[13px] active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
                boxShadow: '0 4px 12px -4px rgba(154,5,38,0.4)',
              }}
            >
              Ver programas →
            </Link>
          </div>
        )}

        {/* Multi-subscription pills */}
        {subscriptions.length > 1 && detailSubscription && (
          <div className="mb-5 flex flex-wrap gap-2">
            {subscriptions.map((s) => {
              const active = s.id === detailSubscription.id;
              const statusColor = s.status === 'active' ? KORE.sage : s.status === 'expired' ? KORE.amber : KORE.sakuraDeep;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSubscriptionId(s.id)}
                  className="text-[11px] font-semibold transition-all"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    background: active ? KORE.ivory : 'rgba(255,255,255,0.55)',
                    color: active ? KORE.wineDark : 'rgba(103,15,34,0.65)',
                    border: active ? `1px solid ${statusColor}66` : '1px solid rgba(103,15,34,0.12)',
                    boxShadow: active ? `0 4px 10px -4px ${statusColor}40` : 'none',
                  }}
                >
                  {s.package.title} · {STATUS_LABEL[s.status] ?? s.status}
                </button>
              );
            })}
          </div>
        )}

        {!hasOwnActiveSubscription && subscriptions.some((s) => s.is_guest) && (
          <p className="text-[12px] mb-5" style={{ color: 'rgba(103,15,34,0.55)' }}>
            Estás entrenando como invitado/a.{' '}
            <Link href="/programs" className="underline underline-offset-2" style={{ color: '#9A0526' }}>
              Ver planes propios
            </Link>{' '}
            para tener sesiones personalizadas.
          </p>
        )}

        {/* Detail panel */}
        {detailSubscription && (
          <>
            {/* Guest badge */}
            {detailSubscription.is_guest && (
              <div
                className="mb-5 flex items-center gap-3"
                style={{
                  padding: '14px 16px',
                  borderRadius: 16,
                  background: 'rgba(244,199,199,0.18)',
                  border: '1px solid rgba(228,168,168,0.40)',
                }}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ color: '#9A0526' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#9A0526' }}>Plan Pareja — invitado/a</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'rgba(58,33,40,0.7)' }}>Acceso de solo lectura. El anfitrión gestiona las sesiones.</p>
                </div>
              </div>
            )}

            {/* HERO */}
            <Hero sub={detailSubscription} />

            {/* Benefits + Actions row */}
            <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <BenefitsCard sub={detailSubscription} />
              {detailSubscription.is_guest ? (
                <div
                  className="flex flex-col gap-3.5"
                  style={{
                    background: 'rgba(255,255,255,0.65)',
                    borderRadius: 28,
                    padding: 'clamp(20px, 2.5vw, 28px)',
                    border: '1px solid rgba(103,15,34,0.08)',
                  }}
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Acceso de invitado</p>
                    <h2 className="font-heading text-xl font-semibold mt-1.5" style={{ color: KORE.wineDark }}>Solo lectura</h2>
                    <p className="text-[12.5px] mt-2 leading-[1.55]" style={{ color: 'rgba(103,15,34,0.65)' }}>
                      El anfitrión gestiona pagos, sesiones y configuración del plan. Tú solo visualizas.
                    </p>
                  </div>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 text-[12px] font-semibold text-white active:scale-95 transition-transform"
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: KORE.green,
                    }}
                  >
                    Escribir por WhatsApp
                  </a>
                </div>
              ) : (
                <ActionsCard
                  sub={detailSubscription}
                  actionLoading={actionLoading}
                  onCancel={handleCancelConfirm}
                  showCancelConfirm={showCancelConfirm}
                  setShowCancelConfirm={setShowCancelConfirm}
                />
              )}
            </div>

            {/* Guest invite (duo plan host only) */}
            {detailSubscription.status === 'active' &&
              detailSubscription.package.category === 'semi_personalizado' &&
              !detailSubscription.is_guest && (
                <div className="mt-8">
                  <GuestCard
                    sub={detailSubscription}
                    actionLoading={actionLoading}
                    error={guestError}
                    guestEmail={guestEmail}
                    setGuestEmail={setGuestEmail}
                    onInvite={handleInviteGuest}
                    onRevoke={handleRevokeGuest}
                  />
                </div>
              )}

            {/* Sessions */}
            <div className="mt-8">
              <SessionsCard
                bookings={bookings}
                subscriptionId={detailSubscription.id}
                isGuest={!!detailSubscription.is_guest}
                onSelect={(b) => setSessionModalBooking(b)}
              />
            </div>

            {/* Payments */}
            <div className="mt-8">
              <PaymentsCard payments={payments} />
            </div>

            {/* Footer */}
            <div className="mt-10 text-center text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.40)' }}>
              KÓRE · Mi Suscripción · {formatDate(detailSubscription.expires_at)}
            </div>
          </>
        )}
      </div>

      {sessionModalBooking && detailSubscription && (
        <SessionDetailModal
          booking={sessionModalBooking}
          subscriptionId={detailSubscription.id}
          onClose={() => setSessionModalBooking(null)}
          onCanceled={() => {
            setSessionModalBooking(null);
            fetchBookings();
          }}
        />
      )}
    </section>
  );
}
