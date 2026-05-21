'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import {
  Flame, ArrowRight, Play,
  Calendar, ArrowUpRight, Check, X, Trophy, ChevronDown,
} from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import '@/app/components/swiper-overrides.css';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useProgressStore } from '@/lib/stores/progressStore';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';
import UpcomingSessionsCard from '@/app/components/booking/UpcomingSessionsCard';
import SessionDetailModal from '@/app/components/booking/SessionDetailModal';
import type { BookingData } from '@/lib/stores/bookingStore';
import SubscriptionExpiryReminder from '@/app/components/subscription/SubscriptionExpiryReminder';
import SubscriptionDashboardToast from '@/app/components/subscription/SubscriptionDashboardToast';
import ProgressTabsCard from '@/app/components/program/ProgressTabsCard';
import { useAnthropometryStore } from '@/lib/stores/anthropometryStore';
import { usePosturometryStore } from '@/lib/stores/posturometryStore';
import { usePhysicalEvaluationStore } from '@/lib/stores/physicalEvaluationStore';
import { useNutritionStore } from '@/lib/stores/nutritionStore';
import { useParqStore } from '@/lib/stores/parqStore';
import TrainerMessageBanner from '@/app/components/dashboard/TrainerMessageBanner';

// ── Helpers ───────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── AnimatedHero ──────────────────────────────────────────────

function AnimatedHero({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] shadow-2xl"
      style={{ background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)' }}
    >
      <style>{`
        @keyframes kore-orb-1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.15)}}
        @keyframes kore-orb-2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,40px) scale(0.9)}}
        @keyframes kore-orb-3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,30px) scale(1.1)}}
        @keyframes kore-aurora{0%,100%{opacity:0.45}50%{opacity:0.85}}
      `}</style>
      {/* Aurora */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 80% 20%, rgba(255,233,220,0.20) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(20,5,12,0.65) 0%, transparent 55%)',
          animation: 'kore-aurora 8s ease-in-out infinite',
        }}
      />
      {/* Orb 1 */}
      <div
        className="absolute pointer-events-none"
        style={{ top: '20%', right: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)', filter: 'blur(30px)', animation: 'kore-orb-1 9s ease-in-out infinite' }}
      />
      {/* Orb 2 */}
      <div
        className="absolute pointer-events-none"
        style={{ bottom: '10%', left: '20%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'kore-orb-2 11s ease-in-out infinite' }}
      />
      {/* Orb 3 */}
      <div
        className="absolute pointer-events-none"
        style={{ top: '50%', left: '50%', width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, #CD0C3644 0%, transparent 70%)', filter: 'blur(35px)', animation: 'kore-orb-3 7s ease-in-out infinite' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ── Arc ring SVG ──────────────────────────────────────────────

function ArcRing({ pct, size = 56, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id="kore-arc-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#670F22" />
          <stop offset="100%" stopColor="#AB0D2F" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E5E5" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#kore-arc-grad)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
      />
    </svg>
  );
}

// ── Projection progress bar ───────────────────────────────────

// ── Real evaluation cards (from stores) ──────────────────────

const KORE_CARDS = {
  wineDark: '#670F22',
  crimson: '#9A0526',
  ruby: '#AB0D2F',
  cream: '#EDE8DC',
  creamLight: '#F2EDE0',
  ivory: '#FFF8EC',
  emerald: '#10B981',
  emeraldDark: '#047857',
  amber: '#F59E0B',
  amberDark: '#A88A2E',
  rose: '#E4A8A8',
  sakura: '#F4C7C7',
  gold: '#E7C8A0',
};

const STATE_COLOR_HEX: Record<string, string> = {
  green: KORE_CARDS.emerald,
  yellow: KORE_CARDS.amber,
  orange: '#F97316',
  red: '#EF4444',
};
const STATE_TEXT_HEX: Record<string, string> = {
  green: KORE_CARDS.emeraldDark,
  yellow: KORE_CARDS.amberDark,
  orange: '#C2410C',
  red: '#DC2626',
};

const num = (s: string | number | null | undefined): number | null => {
  if (s === null || s === undefined || s === '') return null;
  const n = typeof s === 'number' ? s : parseFloat(String(s));
  return Number.isFinite(n) ? n : null;
};

type RealEvalGridProps = {
  posturoEvals: import('@/lib/stores/posturometryStore').PosturometryEvaluation[];
  anthroEvals: import('@/lib/stores/anthropometryStore').AnthropometryEvaluation[];
  physicalEvals: import('@/lib/stores/physicalEvaluationStore').PhysicalEvaluation[];
  parqAssessments: import('@/lib/stores/parqStore').ParqAssessment[];
  todayMood: import('@/lib/stores/profileStore').TodayMood | null;
  motivationMessage?: string;
  gridClass?: string;
  mobile?: boolean;
};

function RealEvalGrid({ posturoEvals, anthroEvals, physicalEvals, parqAssessments, todayMood, motivationMessage, mobile }: RealEvalGridProps) {
  const hasAnthro = anthroEvals.length > 0;
  const hasPosturo = posturoEvals.length > 0;
  const hasPhysical = physicalEvals.length > 0;
  const hasParq = parqAssessments.length > 0;
  if (!hasAnthro && !hasPosturo && !hasPhysical && !hasParq && !todayMood) return null;
  void motivationMessage;

  if (mobile) {
    const slides: React.ReactNode[] = [];
    if (hasAnthro) slides.push(
      <AnthropometriaCard key="anthro" latest={anthroEvals[0]} first={anthroEvals.length > 1 ? anthroEvals[anthroEvals.length - 1] : null} />
    );
    if (hasPosturo) slides.push(
      <PosturometriaCard key="posturo" latest={posturoEvals[0]} first={posturoEvals.length > 1 ? posturoEvals[posturoEvals.length - 1] : null} />
    );
    if (hasPhysical) slides.push(
      <CondicionFisicaCard key="physical" latest={physicalEvals[0]} />
    );

    return (
      <div className="space-y-3">
        {slides.length > 0 && (
          <Swiper
            modules={[Pagination]}
            slidesPerView={1}
            spaceBetween={12}
            pagination={{ clickable: true }}
            style={{ paddingBottom: 32 }}
          >
            {slides.map((slide, i) => (
              <SwiperSlide key={i} style={{ height: 'auto' }}>
                <div className="h-full">{slide}</div>
              </SwiperSlide>
            ))}
          </Swiper>
        )}
        <MobileWellnessCard
          todayMood={todayMood}
          motivationMessage={motivationMessage}
          parqAssessment={hasParq ? parqAssessments[0] : null}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 items-start">
      {hasAnthro && <AnthropometriaCard latest={anthroEvals[0]} first={anthroEvals.length > 1 ? anthroEvals[anthroEvals.length - 1] : null} />}
      {hasPosturo && <PosturometriaCard latest={posturoEvals[0]} first={posturoEvals.length > 1 ? posturoEvals[posturoEvals.length - 1] : null} />}
      {hasPhysical && <CondicionFisicaCard latest={physicalEvals[0]} />}
      <div className="flex flex-col gap-3 md:gap-4">
        <MoodMiniCard todayMood={todayMood} />
        <MotivacionMiniCard message={motivationMessage} />
        {hasParq && <ParqMiniCard latest={parqAssessments[0]} />}
      </div>
    </div>
  );
}

/* ── Card: Antropometría — concentric rings + indicator rows ─────────────── */
function AnthropometriaCard({
  latest, first,
}: {
  latest: import('@/lib/stores/anthropometryStore').AnthropometryEvaluation;
  first: import('@/lib/stores/anthropometryStore').AnthropometryEvaluation | null;
}) {
  const weight = num(latest.weight_kg) ?? 0;
  const bf = num(latest.body_fat_pct) ?? 0;
  const lean = num(latest.lean_mass_kg) ?? 0;
  const weightFirst = first ? num(first.weight_kg) : null;
  const bfFirst = first ? num(first.body_fat_pct) : null;
  const weightDelta = weightFirst !== null ? weight - weightFirst : null;
  const bfDelta = bfFirst !== null ? bf - bfFirst : null;

  const r = 64;
  const c = 2 * Math.PI * r;
  const innerR = r - 16;
  const innerC = 2 * Math.PI * innerR;
  const bfRatio = Math.min(1, bf / 100);

  const rows = [
    {
      label: 'Composición corporal',
      state: latest.bf_category || '—',
      color: latest.bf_color || 'green',
    },
    {
      label: 'IMC – Peso y estatura',
      state: latest.bmi_category || '—',
      color: latest.bmi_color || 'green',
    },
    ...(latest.waist_cm
      ? [{
          label: 'Zona abdominal – Cintura',
          state: latest.waist_risk || '—',
          color: latest.waist_risk_color || 'green',
        }]
      : []),
  ];

  return (
    <Link
      href="/my-diagnosis"
      className="block group"
      style={{
        background: KORE_CARDS.cream,
        borderRadius: 20,
        border: '1px solid rgba(154,5,38,0.10)',
        boxShadow: '0 8px 30px -10px rgba(102,15,34,0.12)',
        padding: 18,
      }}
    >
      <CardHeader title="Antropometría" />

      <div className="mt-3.5 flex items-center gap-3 flex-wrap">
        <div className="relative shrink-0" style={{ width: 144, height: 144 }}>
          <svg width="144" height="144" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="11" />
            <circle cx="72" cy="72" r={r} fill="none" stroke="#10B981" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * bfRatio} />
            <circle cx="72" cy="72" r={innerR} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="9" />
            <circle cx="72" cy="72" r={innerR} fill="none" stroke="#9A0526" strokeWidth="9" strokeLinecap="round" strokeDasharray={innerC} strokeDashoffset={innerC * (1 - bfRatio)} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.10em', color: 'rgba(51,51,51,0.5)' }}>Peso</span>
            <span className="font-heading font-bold leading-none mt-0.5" style={{ fontSize: 28, color: '#1a1410' }}>{weight}</span>
            <span className="text-[10px]" style={{ color: 'rgba(51,51,51,0.4)' }}>kg</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              <span style={{ width: 7, height: 7, borderRadius: 4, background: KORE_CARDS.crimson }} />
              <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.08em', color: 'rgba(51,51,51,0.55)' }}>Grasa</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-heading font-bold tabular-nums" style={{ fontSize: 18, color: '#333' }}>
                {bf}<span className="text-[10px]" style={{ color: 'rgba(51,51,51,0.4)' }}>%</span>
              </span>
              {bfDelta !== null && Math.abs(bfDelta) >= 0.05 && (
                <span className="text-[10px] font-semibold" style={{ color: bfDelta < 0 ? KORE_CARDS.emeraldDark : '#DC2626' }}>
                  {bfDelta < 0 ? '↓' : '↑'}{Math.abs(bfDelta).toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span style={{ width: 7, height: 7, borderRadius: 4, background: KORE_CARDS.emerald }} />
              <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.08em', color: 'rgba(51,51,51,0.55)' }}>Masa libre</span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-heading font-bold tabular-nums" style={{ fontSize: 18, color: '#333' }}>
                {lean}<span className="text-[10px]" style={{ color: 'rgba(51,51,51,0.4)' }}>kg</span>
              </span>
            </div>
          </div>
          {(weightDelta !== null || bfDelta !== null) &&
            ((weightDelta !== null && Math.abs(weightDelta) >= 0.1) || (bfDelta !== null && Math.abs(bfDelta) >= 0.1)) && (
            <div
              className="text-[10px] font-semibold leading-tight"
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(16,185,129,0.10)',
                color: KORE_CARDS.emeraldDark,
              }}
            >
              Desde inicio:{' '}
              <strong>
                {weightDelta !== null && Math.abs(weightDelta) >= 0.1 && (
                  <>{weightDelta < 0 ? '−' : '+'}{Math.abs(weightDelta).toFixed(1)} kg</>
                )}
                {weightDelta !== null && bfDelta !== null && Math.abs(weightDelta) >= 0.1 && Math.abs(bfDelta) >= 0.1 && ' · '}
                {bfDelta !== null && Math.abs(bfDelta) >= 0.1 && (
                  <>{bfDelta < 0 ? '−' : '+'}{Math.abs(bfDelta).toFixed(1)}% grasa</>
                )}
              </strong>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(102,15,34,0.08)' }}>
        {rows.map((row, idx) => <IndicatorRow key={idx} {...row} last={idx === rows.length - 1} />)}
      </div>
    </Link>
  );
}

/* ── Card: Posturometría — radar + zone rows ─────────────────────────────── */
function PosturometriaCard({
  latest, first,
}: {
  latest: import('@/lib/stores/posturometryStore').PosturometryEvaluation;
  first: import('@/lib/stores/posturometryStore').PosturometryEvaluation | null;
}) {
  const global = num(latest.global_index) ?? 0;
  const upper = num(latest.upper_index) ?? 0;
  const central = num(latest.central_index) ?? 0;
  const lower = num(latest.lower_index) ?? 0;
  const globalFirst = first ? num(first.global_index) : null;
  const delta = globalFirst !== null ? global - globalFirst : null;

  const axes = [
    { label: 'Global', value: global },
    { label: 'Sup.', value: upper },
    { label: 'Cen.', value: central },
    { label: 'Inf.', value: lower },
  ];
  const cx = 70, cy = 70, R = 50;
  const angle = (i: number) => (-Math.PI / 2) + (i * (2 * Math.PI / axes.length));
  const point = (v: number, i: number): [number, number] => {
    const ratio = 1 - Math.min(1, v / 1.5);
    return [cx + Math.cos(angle(i)) * R * ratio, cy + Math.sin(angle(i)) * R * ratio];
  };
  const polyPts = axes.map((a, i) => point(a.value, i).join(',')).join(' ');
  const isImproving = delta !== null && delta < -0.05;

  const rows = [
    { label: 'Zona superior', state: latest.upper_category || '—', color: latest.upper_color || 'green', value: upper },
    { label: 'Zona central', state: latest.central_category || '—', color: latest.central_color || 'green', value: central },
    { label: 'Zona inferior', state: latest.lower_category || '—', color: latest.lower_color || 'green', value: lower },
  ];

  return (
    <Link
      href="/my-posturometry"
      className="block group"
      style={{
        background: KORE_CARDS.cream,
        borderRadius: 20,
        border: '1px solid rgba(154,5,38,0.10)',
        boxShadow: '0 8px 30px -10px rgba(102,15,34,0.12)',
        padding: 18,
      }}
    >
      <CardHeader title="Posturometría" />

      <div className="mt-3.5 flex items-center gap-3 flex-wrap">
        <div className="relative shrink-0 grid place-items-center" style={{ width: 144, height: 144 }}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            {[0.33, 0.66, 1].map((s) => (
              <polygon
                key={s}
                points={axes.map((_, i) => [cx + Math.cos(angle(i)) * R * s, cy + Math.sin(angle(i)) * R * s].join(',')).join(' ')}
                fill="none"
                stroke="rgba(102,15,34,0.10)"
                strokeWidth="1"
              />
            ))}
            {axes.map((_, i) => {
              const [x, y] = [cx + Math.cos(angle(i)) * R, cy + Math.sin(angle(i)) * R];
              return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(102,15,34,0.08)" strokeWidth="1" />;
            })}
            <polygon points={polyPts} fill="rgba(52,211,153,0.40)" stroke={KORE_CARDS.emeraldDark} strokeWidth="1.5" strokeLinejoin="round" />
            {axes.map((a, i) => {
              const [x, y] = point(a.value, i);
              return <circle key={i} cx={x} cy={y} r="3" fill={KORE_CARDS.ivory} stroke={KORE_CARDS.emeraldDark} strokeWidth="1.5" />;
            })}
            {axes.map((a, i) => {
              const [x, y] = [cx + Math.cos(angle(i)) * (R + 12), cy + Math.sin(angle(i)) * (R + 12)];
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="Montserrat"
                  fontSize="8"
                  fontWeight="700"
                  fill="rgba(51,51,51,0.55)"
                  letterSpacing="0.08em"
                >
                  {a.label.toUpperCase()}
                </text>
              );
            })}
          </svg>
          <div
            className="absolute"
            style={{
              bottom: -2, left: '50%', transform: 'translateX(-50%)',
              padding: '3px 10px', borderRadius: 999,
              background: KORE_CARDS.ivory,
              border: `1px solid ${STATE_COLOR_HEX[latest.global_color || 'green']}55`,
              color: STATE_TEXT_HEX[latest.global_color || 'green'],
              fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--font-heading), serif',
              boxShadow: '0 2px 6px rgba(102,15,34,0.08)',
            }}
          >
            {global.toFixed(2)}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.10em', color: 'rgba(51,51,51,0.55)' }}>Índice global</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className="font-heading font-bold leading-none"
              style={{ fontSize: 26, color: STATE_TEXT_HEX[latest.global_color || 'green'] }}
            >
              {global.toFixed(2)}
            </span>
            <span className="text-[9px]" style={{ color: 'rgba(51,51,51,0.5)' }}>/ 3</span>
          </div>
          <p className="text-[9px] mt-1" style={{ color: 'rgba(51,51,51,0.45)' }}>Más cerca de 0 = mejor</p>
          {delta !== null && Math.abs(delta) >= 0.05 && (
            <div
              className="text-[10px] font-semibold mt-2"
              style={{
                padding: '5px 10px', borderRadius: 8,
                background: isImproving ? 'rgba(16,185,129,0.10)' : 'rgba(228,168,168,0.18)',
                color: isImproving ? KORE_CARDS.emeraldDark : '#DC2626',
              }}
            >
              {isImproving ? 'Mejoró' : 'Subió'} <strong>{Math.abs(delta).toFixed(2)}</strong> desde inicio
            </div>
          )}
          {latest.notes && (
            <p className="text-[10px] italic mt-2 line-clamp-2 leading-snug" style={{ color: 'rgba(51,51,51,0.55)' }}>
              {latest.notes}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(102,15,34,0.08)' }}>
        {rows.map((row, idx) => (
          <IndicatorRow
            key={idx}
            label={row.label}
            state={row.value.toFixed(2)}
            color={row.color}
            last={idx === rows.length - 1}
          />
        ))}
      </div>
    </Link>
  );
}

/* ── Card: Condición Física — semi-circular gauge + capacities rows ──────── */
function CondicionFisicaCard({
  latest,
}: {
  latest: import('@/lib/stores/physicalEvaluationStore').PhysicalEvaluation;
}) {
  const general = num(latest.general_index) ?? 0;
  const max = 5;
  const pct = Math.min(general / max, 1);

  const gw = 144;
  const gh = 80;
  const gr = 56;
  const cxg = gw / 2;
  const cyg = gh - 6;
  const startA = Math.PI;
  const endA = 2 * Math.PI;

  const arc = (a0: number, a1: number) => {
    const x0 = cxg + Math.cos(a0) * gr;
    const y0 = cyg + Math.sin(a0) * gr;
    const x1 = cxg + Math.cos(a1) * gr;
    const y1 = cyg + Math.sin(a1) * gr;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${gr} ${gr} 0 ${large} 1 ${x1} ${y1}`;
  };
  const valueAngle = startA + (endA - startA) * pct;

  const rows = [
    { label: 'Fuerza', state: latest.strength_category || '—', color: latest.strength_color || 'green' },
    { label: 'Resistencia', state: latest.endurance_category || '—', color: latest.endurance_color || 'green' },
    { label: 'Movilidad', state: latest.mobility_category || '—', color: latest.mobility_color || 'green' },
    { label: 'Equilibrio', state: latest.balance_category || '—', color: latest.balance_color || 'green' },
  ];

  const generalColor = latest.general_color || 'green';

  return (
    <Link
      href="/my-physical-evaluation"
      className="block group"
      style={{
        background: KORE_CARDS.cream,
        borderRadius: 20,
        border: '1px solid rgba(154,5,38,0.10)',
        boxShadow: '0 8px 30px -10px rgba(102,15,34,0.12)',
        padding: 18,
      }}
    >
      <CardHeader title="Condición Física" />

      <div className="mt-3.5 flex items-center gap-3 flex-wrap">
        <div className="relative shrink-0" style={{ width: gw, height: gh + 26 }}>
          <svg width={gw} height={gh + 26}>
            <path d={arc(startA, endA)} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="11" strokeLinecap="round" />
            {(() => {
              const segs: { color: string; from: number; to: number }[] = [
                { color: '#FF4040', from: 0,    to: 0.34 },
                { color: '#F59E0B', from: 0.34, to: 0.67 },
                { color: '#10B981', from: 0.67, to: 1.00 },
              ];
              const span = endA - startA;
              return segs.map((seg, i) => {
                const segEnd = Math.min(pct, seg.to);
                if (segEnd <= seg.from) return null;
                const a0 = startA + span * seg.from;
                const a1 = startA + span * segEnd;
                return (
                  <path
                    key={i}
                    d={arc(a0, a1)}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="11"
                    strokeLinecap={i === 0 || segEnd === pct ? 'round' : 'butt'}
                  />
                );
              });
            })()}
            <circle
              cx={cxg + Math.cos(valueAngle) * gr}
              cy={cyg + Math.sin(valueAngle) * gr}
              r="5"
              fill={KORE_CARDS.ivory}
              stroke={STATE_COLOR_HEX[generalColor]}
              strokeWidth="2"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end" style={{ paddingBottom: 4 }}>
            <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.10em', color: 'rgba(51,51,51,0.5)' }}>Índice general</span>
            <span className="font-heading font-bold leading-none mt-0.5" style={{ fontSize: 26, color: '#1a1410' }}>{general.toFixed(2)}</span>
            <span
              className="text-[9px] font-bold uppercase mt-1"
              style={{ letterSpacing: '0.08em', color: STATE_TEXT_HEX[generalColor] }}
            >
              ● {latest.general_category || '—'}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.10em', color: 'rgba(51,51,51,0.55)' }}>Próximo paso</p>
          <p className="text-[11px] mt-1.5 leading-snug italic" style={{ color: '#333' }}>
            {latest.notes
              ? `"${latest.notes.length > 80 ? latest.notes.slice(0, 80) + '…' : latest.notes}"`
              : 'Tu trainer ajusta el plan según estos resultados.'}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(102,15,34,0.08)' }}>
        {rows.map((row, idx) => <IndicatorRow key={idx} {...row} last={idx === rows.length - 1} />)}
      </div>
    </Link>
  );
}

/* ── Mini card: Mood 1–10 scale (matches profile) ───────────────────────── */
const MOOD_LABELS_DASH = [
  'Muy bajo', 'Bajo', 'Apagado', 'Cansado', 'Estable',
  'Bien', 'Activo', 'Energético', 'Pleno', 'Imparable',
];

function MoodMiniCard({ todayMood }: { todayMood: import('@/lib/stores/profileStore').TodayMood | null }) {
  const { submitMood } = useProfileStore();
  const initial = todayMood?.score ?? null;
  const [mood, setMood] = useState<number | null>(initial);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMood(todayMood?.score ?? null);
  }, [todayMood?.score]);

  const handlePick = async (n: number) => {
    setMood(n);
    setSubmitting(true);
    try {
      await submitMood(n);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: KORE_CARDS.cream,
        borderRadius: 16,
        border: '1px solid rgba(154,5,38,0.08)',
        padding: 18,
        boxShadow: '0 4px 16px -10px rgba(102,15,34,0.10)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: KORE_CARDS.wineDark }}>
          ¿Cómo te sientes hoy?
        </p>
        <span className="text-[9px] italic" style={{ color: 'rgba(51,51,51,0.45)' }}>
          {mood ? '✓ registrado' : 'sin registrar'}
        </span>
      </div>
      <p className="text-[11px] mt-1.5 leading-[1.5]" style={{ color: 'rgba(51,51,51,0.55)' }}>
        Del 1 al 10 — tu bienestar es parte del proceso.
      </p>
      <div className="grid grid-cols-10 gap-1 mt-3">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const sel = mood === n;
          const intensity = n / 10;
          return (
            <button
              key={n}
              type="button"
              disabled={submitting}
              onClick={() => handlePick(n)}
              className="font-heading font-bold transition-all active:scale-95 disabled:opacity-60"
              style={{
                aspectRatio: '1',
                borderRadius: 7,
                border: sel ? `2px solid ${KORE_CARDS.crimson}` : '1px solid rgba(103,15,34,0.12)',
                background: sel
                  ? `linear-gradient(135deg, rgba(244,199,199,${0.25 + intensity * 0.5}), rgba(231,200,160,${0.18 + intensity * 0.4}))`
                  : `rgba(255,248,236,${0.4 + intensity * 0.35})`,
                fontSize: 11,
                color: sel ? KORE_CARDS.wineDark : 'rgba(103,15,34,0.55)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: sel ? '0 4px 10px -4px rgba(154,5,38,0.30)' : 'none',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="text-center italic mt-2.5 text-[10px]" style={{ color: 'rgba(103,15,34,0.55)' }}>
        {mood ? `${MOOD_LABELS_DASH[mood - 1]} · Registrado para hoy` : 'Toca un número para registrar.'}
      </p>
    </div>
  );
}

/* ── Mini card: Motivación quote with sakura petal ────────────────────────── */
function MotivacionMiniCard({ message }: { message?: string }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #FFF8EC 0%, #F5EFE3 100%)',
        borderRadius: 16,
        border: '1px solid rgba(154,5,38,0.10)',
        padding: 22,
      }}
    >
      <svg
        className="absolute pointer-events-none"
        style={{ top: -8, right: -8, width: 60, height: 60, opacity: 0.18, transform: 'rotate(20deg)' }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z"
          fill={KORE_CARDS.crimson}
        />
      </svg>
      <span
        className="absolute font-heading"
        style={{ top: 4, left: 16, fontSize: 56, color: 'rgba(154,5,38,0.12)', lineHeight: 1, fontWeight: 700 }}
      >
        "
      </span>
      <div className="relative">
        <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(102,15,34,0.55)' }}>
          Tu motivación de hoy
        </p>
        <p
          className="font-heading mt-3.5 italic"
          style={{
            fontSize: 16, fontWeight: 600,
            color: KORE_CARDS.wineDark,
            lineHeight: 1.4,
            paddingLeft: 12,
          }}
        >
          {message ?? 'Cada día que entrenas, construyes la mejor versión de ti.'}
        </p>
        <div
          className="flex justify-between items-center mt-3 pt-2.5"
          style={{ borderTop: '1px dashed rgba(102,15,34,0.18)' }}
        >
          <span className="text-[10px] italic" style={{ color: 'rgba(51,51,51,0.50)' }}>— Personalizado según tu progreso</span>
        </div>
      </div>
    </div>
  );
}

/* ── Mini card: PAR-Q+ stamp + dots progress ──────────────────────────────── */
function ParqMiniCard({ latest }: { latest: import('@/lib/stores/parqStore').ParqAssessment }) {
  const { yes_count, risk_color } = latest;
  const totalQ = 7;
  const stampColor = STATE_COLOR_HEX[risk_color] || KORE_CARDS.amber;
  const stampTextColor = STATE_TEXT_HEX[risk_color] || KORE_CARDS.amberDark;
  const dots = Array.from({ length: totalQ }, (_, i) => i < yes_count);

  // Compute "Vigente hasta" = created_at + 90 days
  const validUntil = (() => {
    const d = new Date(latest.created_at);
    d.setDate(d.getDate() + 90);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  return (
    <Link
      href="/my-parq"
      className="block group"
      style={{
        background: KORE_CARDS.cream,
        borderRadius: 16,
        border: '1px solid rgba(154,5,38,0.10)',
        padding: 18,
        boxShadow: '0 4px 16px -10px rgba(102,15,34,0.10)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="font-heading" style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.04em', color: KORE_CARDS.wineDark }}>
          PAR-Q<span className="text-[11px]">+</span>
        </div>
        <span className="text-[11px]" style={{ color: 'rgba(51,51,51,0.4)' }}>›</span>
      </div>
      <div className="mt-3.5 flex items-center gap-3.5">
        <div
          className="shrink-0 text-center font-heading uppercase"
          style={{
            padding: '8px 12px',
            border: `2px solid ${stampColor}`,
            borderRadius: 6,
            color: stampTextColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            background: `${stampColor}1A`,
            lineHeight: 1.2,
            transform: 'rotate(-3deg)',
          }}
        >
          {risk_color === 'green' ? 'Apto' : risk_color === 'yellow' ? <>Apto<br/>con precaución</> : <>Requiere<br/>valoración</>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.10em', color: 'rgba(51,51,51,0.55)' }}>Respuestas afirmativas</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-heading font-bold leading-none" style={{ fontSize: 22, color: stampTextColor }}>{yes_count}</span>
            <span className="text-[10px]" style={{ color: 'rgba(51,51,51,0.5)' }}>/ {totalQ}</span>
          </div>
          <div className="flex gap-1 mt-2">
            {dots.map((on, i) => (
              <span
                key={i}
                className="flex-1"
                style={{
                  height: 5, borderRadius: 2.5,
                  background: on ? `linear-gradient(90deg, ${stampColor}, ${stampTextColor})` : 'rgba(102,15,34,0.10)',
                }}
              />
            ))}
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(51,51,51,0.55)' }}>
            Vigente hasta <strong style={{ color: KORE_CARDS.wineDark }}>{validUntil}</strong>
          </p>
        </div>
      </div>
    </Link>
  );
}

/* ── Mobile combined wellness card (Mood + Motivación + PAR-Q+) ─────────── */
function MobileWellnessCard({
  todayMood,
  motivationMessage,
  parqAssessment,
}: {
  todayMood: import('@/lib/stores/profileStore').TodayMood | null;
  motivationMessage?: string;
  parqAssessment: import('@/lib/stores/parqStore').ParqAssessment | null;
}) {
  const { submitMood } = useProfileStore();
  const initial = todayMood?.score ?? null;
  const [mood, setMood] = useState<number | null>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [showSelector, setShowSelector] = useState(initial === null);

  useEffect(() => {
    setMood(todayMood?.score ?? null);
    setShowSelector(todayMood?.score == null);
  }, [todayMood?.score]);

  const handlePick = async (n: number) => {
    setMood(n);
    setSubmitting(true);
    try {
      await submitMood(n);
      setShowSelector(false);
    } finally {
      setSubmitting(false);
    }
  };

  const parqDisplay = parqAssessment
    ? (() => {
        const stampColor = STATE_COLOR_HEX[parqAssessment.risk_color] || KORE_CARDS.amber;
        const stampTextColor = STATE_TEXT_HEX[parqAssessment.risk_color] || KORE_CARDS.amberDark;
        const d = new Date(parqAssessment.created_at);
        d.setDate(d.getDate() + 90);
        const validUntil = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        return { stampColor, stampTextColor, validUntil };
      })()
    : null;

  return (
    <div
      style={{
        background: KORE_CARDS.cream,
        borderRadius: 16,
        border: '1px solid rgba(154,5,38,0.10)',
        padding: 18,
        boxShadow: '0 4px 16px -10px rgba(102,15,34,0.10)',
      }}
    >
      {/* Sección 1 — Ánimo */}
      <div>
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <p className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '0.16em', color: KORE_CARDS.wineDark }}>
            Tu ánimo hoy
          </p>
          <span className="text-[9px] italic" style={{ color: 'rgba(51,51,51,0.45)' }}>
            {mood ? '✓ registrado' : 'sin registrar'}
          </span>
        </div>
        {!showSelector && mood !== null ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span
                className="font-heading font-bold tabular-nums leading-none"
                style={{ fontSize: 22, color: KORE_CARDS.wineDark }}
              >
                {mood}
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(51,51,51,0.45)' }}>/10</span>
              <span
                className="text-[12px] truncate"
                style={{ color: 'rgba(51,51,51,0.7)', marginLeft: 4 }}
              >
                · {MOOD_LABELS_DASH[mood - 1]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="text-[10.5px] font-semibold uppercase tracking-[0.1em] active:scale-[0.97] transition-transform shrink-0"
              style={{ color: 'rgba(102,15,34,0.6)' }}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const sel = mood === n;
              const intensity = n / 10;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={submitting}
                  onClick={() => handlePick(n)}
                  className="font-heading font-bold transition-all active:scale-95 disabled:opacity-60"
                  style={{
                    aspectRatio: '1',
                    borderRadius: 6,
                    border: sel ? `2px solid ${KORE_CARDS.crimson}` : '1px solid rgba(103,15,34,0.12)',
                    background: sel
                      ? `linear-gradient(135deg, rgba(244,199,199,${0.25 + intensity * 0.5}), rgba(231,200,160,${0.18 + intensity * 0.4}))`
                      : `rgba(255,248,236,${0.4 + intensity * 0.35})`,
                    fontSize: 10.5,
                    color: sel ? KORE_CARDS.wineDark : 'rgba(103,15,34,0.55)',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: sel ? '0 3px 8px -4px rgba(154,5,38,0.30)' : 'none',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(102,15,34,0.06)', marginTop: 14, marginBottom: 14 }} />

      {/* Sección 2 — Motivación */}
      <div className="relative">
        <p
          className="text-[9.5px] font-bold uppercase mb-2"
          style={{ letterSpacing: '0.16em', color: KORE_CARDS.wineDark }}
        >
          Tu motivación
        </p>
        <svg
          className="absolute pointer-events-none"
          style={{ top: -4, right: -4, width: 40, height: 40, opacity: 0.15, transform: 'rotate(20deg)' }}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z"
            fill={KORE_CARDS.crimson}
          />
        </svg>
        <p
          className="font-heading italic line-clamp-2 leading-snug pr-8"
          style={{ fontSize: 14, fontWeight: 600, color: KORE_CARDS.wineDark }}
        >
          {motivationMessage ?? 'Cada día que entrenas, construyes la mejor versión de ti.'}
        </p>
      </div>

      {/* Sección 3 — PAR-Q+ */}
      {parqAssessment && parqDisplay && (
        <>
          <div style={{ borderTop: '1px solid rgba(102,15,34,0.06)', marginTop: 14, marginBottom: 14 }} />
          <Link href="/my-parq" className="block group">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <p
                className="text-[9.5px] font-bold uppercase"
                style={{ letterSpacing: '0.16em', color: KORE_CARDS.wineDark }}
              >
                PAR-Q<span style={{ fontSize: 9 }}>+</span>
              </p>
              <span className="text-[11px]" style={{ color: 'rgba(51,51,51,0.4)' }}>›</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="text-[10.5px] font-bold uppercase whitespace-nowrap"
                style={{
                  padding: '4px 9px',
                  borderRadius: 999,
                  letterSpacing: '0.08em',
                  background: `${parqDisplay.stampColor}1A`,
                  border: `1px solid ${parqDisplay.stampColor}55`,
                  color: parqDisplay.stampTextColor,
                }}
              >
                {parqAssessment.risk_label}
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: 'rgba(51,51,51,0.6)' }}>
                <strong style={{ color: parqDisplay.stampTextColor }}>{parqAssessment.yes_count}</strong>
                <span style={{ color: 'rgba(51,51,51,0.4)' }}>/7</span>
              </span>
              <span className="text-[10.5px]" style={{ color: 'rgba(51,51,51,0.5)' }}>
                Vigente hasta <strong style={{ color: KORE_CARDS.wineDark }}>{parqDisplay.validUntil}</strong>
              </span>
            </div>
          </Link>
        </>
      )}
    </div>
  );
}

/* ── Card chrome ────────────────────────────────────────────────────────── */
function CardHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="font-heading uppercase"
        style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.04em', color: KORE_CARDS.wineDark }}
      >
        {title}
      </span>
      <span className="text-[11px] flex items-center gap-1.5" style={{ color: 'rgba(51,51,51,0.45)' }}>
        Ver detalle<span className="text-[14px]">›</span>
      </span>
    </div>
  );
}

function IndicatorRow({
  label, state, color, last,
}: { label: string; state: string; color: string; last?: boolean }) {
  const dotColor = STATE_COLOR_HEX[color] || KORE_CARDS.emerald;
  const textColor = STATE_TEXT_HEX[color] || KORE_CARDS.emeraldDark;
  return (
    <div
      className="flex items-center justify-between gap-2"
      style={{
        padding: '8px 0',
        borderBottom: last ? 'none' : '1px solid rgba(102,15,34,0.06)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: 4, background: dotColor }} />
        <span className="text-[12.5px] font-medium truncate" style={{ color: '#333' }}>{label}</span>
      </div>
      <span className="text-[11.5px] font-bold tabular-nums shrink-0" style={{ color: textColor }}>
        {state}{' '}
        <span className="font-normal" style={{ color: 'rgba(51,51,51,0.3)' }}>›</span>
      </span>
    </div>
  );
}

/* ── SessionCard (mobile + desktop) — accordion mobile con GSAP ─────────── */
type SessionCardProps = {
  className?: string;
  mobile?: boolean;
  formattedDate: string | null;
  formattedTime: string;
  sessionInDays: number | null;
  trainerName: string | null;
  sessionObjective?: string;
  expanded?: boolean;
  onToggle?: () => void;
  onShowUpcoming?: () => void;
};

function SessionCard({
  className = '',
  mobile = false,
  formattedDate,
  formattedTime,
  sessionInDays,
  trainerName,
  sessionObjective,
  expanded = false,
  onToggle,
  onShowUpcoming,
}: SessionCardProps) {
  const accordionRef = useRef<HTMLDivElement>(null);
  const firstMount = useRef(true);

  useEffect(() => {
    if (!mobile || !accordionRef.current) return;
    const el = accordionRef.current;

    if (firstMount.current) {
      firstMount.current = false;
      gsap.set(el, expanded
        ? { height: 'auto', opacity: 1, display: 'block' }
        : { height: 0, opacity: 0, display: 'none', overflow: 'hidden' });
      return;
    }

    if (expanded) {
      gsap.set(el, { display: 'block', overflow: 'hidden' });
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.4, ease: 'power3.out' },
      );
    } else {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.in',
        onComplete: () => {
          if (accordionRef.current) gsap.set(accordionRef.current, { display: 'none' });
        },
      });
    }
  }, [expanded, mobile]);

  return (
    <div
      className={`relative overflow-hidden rounded-[22px] text-white flex flex-col ${mobile ? 'p-4' : 'p-5'} ${className}`}
      style={{
        background: 'linear-gradient(135deg, #670F22 0%, #9A0526 55%, #AB0D2F 100%)',
        boxShadow: '0 14px 36px -14px rgba(103,15,34,0.55)',
      }}
    >
      <style>{`
        @keyframes session-orb-a{0%,100%{transform:translate(0,0)}50%{transform:translate(36px,-26px)}}
        @keyframes session-orb-b{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,28px)}}
      `}</style>
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-12%', right: '-8%', width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96,165,250,0.45) 0%, transparent 70%)',
          filter: 'blur(48px)', animation: 'session-orb-a 11s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-15%', left: '-6%', width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,64,175,0.42) 0%, transparent 70%)',
          filter: 'blur(50px)', animation: 'session-orb-b 13s ease-in-out infinite',
        }}
      />

      {mobile ? (
        <div className="relative flex flex-col">
          <p className="text-[10px] text-white/55 uppercase tracking-[0.14em] font-semibold mb-2">
            Próxima sesión
          </p>
          <p className="font-heading text-[20px] font-semibold text-white capitalize leading-tight mb-1">
            {formattedDate ?? 'Sin sesión agendada'}
          </p>
          {formattedDate && (
            <div className="flex items-center gap-2 text-[13px] text-white/85">
              <span className="font-semibold tabular-nums">{formattedTime}</span>
              {trainerName && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/45" aria-hidden />
                  <span className="truncate">{trainerName}</span>
                </>
              )}
            </div>
          )}
          {formattedDate && onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="mt-3 flex items-center justify-between w-full text-left text-[11px] text-white/60 font-semibold uppercase tracking-[0.1em] py-1.5 active:scale-[0.99] transition-transform"
              aria-expanded={expanded}
            >
              <span>{expanded ? 'Ocultar detalle' : 'Ver detalle'}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
            </button>
          )}
          {formattedDate && (
            <div
              ref={accordionRef}
              style={{ display: 'none', height: 0, opacity: 0, overflow: 'hidden' }}
            >
              <div
                className="mt-2 pt-3 space-y-2.5"
                style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}
              >
                {sessionInDays !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/55 uppercase tracking-[0.1em] font-semibold">Faltan</span>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                      style={{ background: 'rgba(255,255,255,0.15)' }}
                    >
                      {sessionInDays} {sessionInDays === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-white/55 uppercase tracking-[0.1em] font-semibold mb-1">Objetivo</p>
                  <p className="text-[12px] text-white/80 leading-relaxed">
                    {sessionObjective ?? 'Continúa tu transformación'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {onShowUpcoming && (
            <button
              type="button"
              onClick={onShowUpcoming}
              className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/[0.12] transition-colors active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              <Calendar className="w-3.5 h-3.5" strokeWidth={2} /> Próximas sesiones
            </button>
          )}
        </div>
      ) : (
        <div className="relative flex flex-col flex-1">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[10px] text-white/55 uppercase tracking-[0.14em] font-semibold">
              Próxima sesión presencial
            </p>
            {sessionInDays !== null && (
              <span
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                en {sessionInDays}d
              </span>
            )}
          </div>
          <p className="font-heading text-[20px] xl:text-[28px] font-semibold text-white capitalize leading-tight mb-1">
            {formattedDate ?? 'Sin sesión agendada'}
          </p>
          {formattedDate && (
            <p className="text-[13px] xl:text-[14px] text-white/85 mb-3">
              {formattedTime}
            </p>
          )}
          {trainerName && (
            <div className="py-3 my-1 flex-1" style={{ borderTop: '1px solid rgba(255,255,255,0.18)', borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
              <p className="text-[11px] text-white/55 font-semibold uppercase tracking-[0.1em] mb-1">Coach</p>
              <p className="text-[14px] text-white font-semibold">{trainerName}</p>
            </div>
          )}
          <p className="text-[12px] text-white/70 flex-1 mt-2 leading-relaxed">
            {sessionObjective ?? 'Continúa tu transformación'}
          </p>
          {onShowUpcoming && (
            <button
              type="button"
              onClick={onShowUpcoming}
              className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/[0.12] transition-colors active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              <Calendar className="w-3.5 h-3.5" strokeWidth={2} /> Próximas sesiones
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const {
    activeSubscription: sub,
    subscriptions,
    hasOwnActiveSubscription,
    subscriptionsLoaded,
  } = useSubscriptionStore();
  const { upcomingReminder, bookings, fetchUpcomingReminder, fetchBookings } = useBookingStore();
  const { profile, todayMood, fetchProfile } = useProfileStore();
  const { koreIndex, fetchPending: fetchPendingAssessments } = usePendingAssessmentsStore();
  const { todayLog: nutritionTodayLog, fetchTodayLog: fetchNutritionToday } = useNutritionDailyStore();
  const { activeProgram, fetchActiveProgram } = useProgramStore();
  const { weeklySummary, fetchWeeklySummary } = useProgressStore();
  const { evaluations: anthroEvals, loaded: anthroLoaded, fetchMyEvaluations: fetchMyAnthrometry } = useAnthropometryStore();
  const { evaluations: posturoEvals, loaded: posturoLoaded, fetchMyEvaluations: fetchMyPosturo } = usePosturometryStore();
  const { evaluations: physicalEvals, loaded: physicalLoaded, fetchMyEvaluations: fetchMyPhysical } = usePhysicalEvaluationStore();
  const { entries: nutritionEntries, fetchMyEntries: fetchMyNutrition } = useNutritionStore();
  const { assessments: parqAssessments, loaded: parqLoaded, fetchMyAssessments: fetchMyParq } = useParqStore();
  const profileFetchedRef = useRef(false);

  // Mobile accordion states
  const [sessionExpanded, setSessionExpanded] = useState(false);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);

  // Staggered fetch waves to stay below nginx's per-IP `limit_req` burst.
  // Without this the dashboard fired ~13 parallel requests on mount and the
  // server returned a chain of 429s. We split it into 3 waves of <=4 each,
  // gated by Promise.allSettled so a single slow/failed call doesn't stall
  // the rest. Stores have in-flight + "already loaded" guards, so re-entries
  // (e.g. fast tab switches) are no-ops.
  useEffect(() => {
    let cancelled = false;
    // Skip si el store ya cargó (éxito previo) — evita re-fetchear en cada
    // revisita y la presión de rate-limit que vaciaba cards de evaluación.
    const skipAnthro = anthroLoaded;
    const skipPosturo = posturoLoaded;
    const skipPhysical = physicalLoaded;
    const skipNutrition = nutritionEntries.length > 0;
    const skipParq = parqLoaded;

    (async () => {
      // Wave 1 — identity + primary signals (gates the page).
      // NOTE: fetchSubscriptions is already fired by `(app)/layout.tsx` for
      // customers; we don't repeat it here. fetchProfile dedupes itself in
      // the store, so multiple callers (CTA / MoodCheckIn / dashboard) are safe.
      await Promise.allSettled([
        profileFetchedRef.current ? Promise.resolve() : fetchProfile(),
        fetchPendingAssessments(),
        fetchActiveProgram(),
      ]);
      profileFetchedRef.current = true;
      if (cancelled) return;

      // Wave 2 — above-the-fold session/program data
      await Promise.allSettled([
        fetchUpcomingReminder(),
        fetchBookings(),
        fetchWeeklySummary(),
        fetchNutritionToday(),
      ]);
      if (cancelled) return;

      // Wave 3 — assessment history (lazy: skip if cached in store)
      await Promise.allSettled([
        skipAnthro ? Promise.resolve() : fetchMyAnthrometry(),
        skipPosturo ? Promise.resolve() : fetchMyPosturo(),
        skipPhysical ? Promise.resolve() : fetchMyPhysical(),
        skipNutrition ? Promise.resolve() : fetchMyNutrition(),
        skipParq ? Promise.resolve() : fetchMyParq(),
      ]);
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Streak ─────────────────────────────────────────────────
  // Source: weekly adherence summary (matches /mi-programa).
  const streakCount = weeklySummary?.streak?.current ?? 0;
  const longestStreak = weeklySummary?.streak?.longest ?? 0;

  // ── Session ────────────────────────────────────────────────
  const formattedDate = upcomingReminder?.starts_at
    ? new Date(upcomingReminder.starts_at).toLocaleDateString('es-CO', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : null;
  const formattedTime = upcomingReminder?.starts_at
    ? new Date(upcomingReminder.starts_at).toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '';
  const sessionInDays = upcomingReminder?.starts_at
    ? Math.max(0, Math.ceil(
        (new Date(upcomingReminder.starts_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ))
    : null;
  const trainerName = upcomingReminder?.trainer
    ? `${upcomingReminder.trainer.first_name} ${upcomingReminder.trainer.last_name}`.trim()
    : null;

  // ── Nutrition ──────────────────────────────────────────────
  const mealLabels: Record<string, string> = {
    desayuno: 'Desayuno',
    media_manana: 'Media mañana',
    almuerzo: 'Almuerzo',
    merienda: 'Merienda',
    cena: 'Cena',
  };
  const mealEntries = nutritionTodayLog?.meal_entries ?? [];
  const nutritionTotal = mealEntries.length;
  const nutritionCompleted = mealEntries.filter((e) => e.status === 'completed').length;
  const nutritionPct = nutritionTotal > 0 ? Math.round((nutritionCompleted / nutritionTotal) * 100) : 0;

  // ── Program day ────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const todayProgDay = activeProgram?.days?.find((d) => d.date === today);
  const hasRoutine = !!(todayProgDay && todayProgDay.day_type !== 'rest' && todayProgDay.exercises.length > 0);
  const allExercises = todayProgDay?.exercises ?? [];
  const exerciseCount = allExercises.length;
  const estimatedMin = exerciseCount * 8;
  const previewExercises = allExercises.slice(0, 4);
  const dayLabel = todayProgDay?.day_type === 'active_rest' ? 'Descanso activo' : 'Entrenamiento';

  // ── KÓRE score color ───────────────────────────────────────
  const scoreColorClass =
    koreIndex?.kore_color === 'green' ? 'text-emerald-600'
    : koreIndex?.kore_color === 'yellow' ? 'text-amber-500'
    : koreIndex?.kore_color === 'orange' ? 'text-orange-500'
    : 'text-kore-red';

  // ── Historial (past confirmed bookings) ────────────────────
  const pastBookings = bookings
    .filter((b) => new Date(b.starts_at).getTime() < Date.now())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
    .slice(0, 5);

  // ── Special states ─────────────────────────────────────────
  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div
          className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full"
          role="status"
          aria-label="Cargando"
        />
      </section>
    );
  }

  const isGuestDashboard =
    subscriptionsLoaded &&
    !hasOwnActiveSubscription &&
    subscriptions.some((s) => s.is_guest && s.status === 'active');

  if (subscriptionsLoaded && !hasOwnActiveSubscription && subscriptions.length === 0) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none lg:w-96 lg:h-96">
          <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
        </div>
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-kore-red/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark mb-3">
            Bienvenido/a, {user.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-kore-gray-dark/60 mb-2 leading-relaxed">
            Tu cuenta está lista. Para comenzar tu transformación y acceder a todas las funciones de KÓRE, activa tu plan.
          </p>
          <p className="text-xs text-kore-gray-dark/40 mb-8">
            Sesiones, evaluaciones, calendario y más — todo disponible con tu plan activo.
          </p>
          <Link
            href="/programs"
            className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-8 py-3.5 rounded-xl transition-colors text-sm"
          >
            Ver programas
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-kore-cream relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none lg:w-96 lg:h-96">
        <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
      </div>

      <UpcomingSessionReminder />
      <SubscriptionExpiryReminder />
      <SubscriptionDashboardToast />

      {showUpcoming && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowUpcoming(false); }}
        >
          <div className="w-full max-w-md">
            <UpcomingSessionsCard
              bookings={bookings}
              onClose={() => setShowUpcoming(false)}
              onSelectBooking={(b) => setSelectedBooking(b)}
            />
          </div>
        </div>,
        document.body,
      )}

      {selectedBooking && createPortal(
        <SessionDetailModal
          booking={selectedBooking}
          subscriptionId={selectedBooking.subscription_id_display ?? 0}
          onClose={() => setSelectedBooking(null)}
          onCanceled={() => { setSelectedBooking(null); fetchBookings(); }}
        />,
        document.body,
      )}

      {/* ════════════════ MOBILE LAYOUT ════════════════ */}
      <div className="xl:hidden px-5 pt-6 pb-24 space-y-3.5">

        {/* Header — 2 columnas: saludo + stack de badges */}
        <div className="grid grid-cols-[1fr_auto] gap-3 items-stretch">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-1.5">
              Tu espacio
            </p>
            <h1 className="font-heading text-[22px] font-semibold text-kore-wine-dark leading-tight">
              {getGreeting()},<br />{user.name.split(' ')[0]}.
            </h1>
          </div>

          <div className="flex flex-col gap-1.5 w-[150px]">
            {/* Fila 1 — Racha */}
            <div
              className="rounded-2xl px-2.5 py-1.5"
              style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(229,229,229,0.5)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Flame className="w-[14px] h-[14px] text-kore-red shrink-0" strokeWidth={2} />
                  <span className="text-[11.5px] font-semibold text-kore-gray-dark truncate">
                    {streakCount} <span className="font-normal text-kore-gray-dark/55">días</span>
                  </span>
                </div>
                <span className="text-[9px] text-kore-gray-dark/45 tabular-nums font-semibold">
                  {streakCount}/{longestStreak || '—'}
                </span>
              </div>
              <div className="h-[3px] bg-kore-gray-dark/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${longestStreak > 0 ? Math.min((streakCount / longestStreak) * 100, 100) : 0}%`,
                    background: 'linear-gradient(to right, #E00000, #9A0526)',
                  }}
                />
              </div>
            </div>

            {/* Fila 2 — Récord + KÓRE */}
            <div className="flex gap-1.5">
              <div
                className="flex-1 flex items-center justify-center gap-1 rounded-2xl px-2 py-1.5"
                style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(229,229,229,0.5)' }}
                aria-label="Récord de racha"
              >
                <Trophy className="w-[13px] h-[13px] text-amber-500" strokeWidth={2} />
                <span className="text-[12.5px] font-bold text-kore-gray-dark tabular-nums">
                  {longestStreak || '—'}
                </span>
              </div>
              {koreIndex?.kore_score !== null && koreIndex?.kore_score !== undefined && (
                <Link
                  href="/my-diagnosis"
                  className="flex-1 flex items-center justify-center gap-1 rounded-2xl px-2 py-1.5 hover:bg-white/70 transition-colors active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(229,229,229,0.5)' }}
                  aria-label="Tu calificación KÓRE"
                >
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/55">KÓRE</span>
                  <span className={`text-[12.5px] font-bold tabular-nums ${scoreColorClass}`}>
                    {koreIndex.kore_score}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Hero */}
        {hasRoutine ? (
          <AnimatedHero>
            <div className="block p-5">
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-1.5" style={{ color: '#E7C8A0' }}>
                  {dayLabel} · Día {todayProgDay?.day_number}
                </p>
                <p className="font-heading text-[26px] font-semibold leading-tight" style={{ color: '#FFF8EC', letterSpacing: '-0.01em' }}>
                  ¿Listo para entrenar?
                </p>
                <p className="text-[13px] mt-1" style={{ color: '#FFE9DC', opacity: 0.75 }}>
                  {exerciseCount} ejercicios · ~{estimatedMin} min
                </p>
              </div>
              <div className="border-t border-white/10 pt-3.5 space-y-0">
                {previewExercises.map((ex, i) => (
                  <div
                    key={ex.id}
                    className="flex items-center gap-2.5 py-1.5"
                    style={{ borderBottom: i < previewExercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    <span className="text-[13px] text-white/35 w-5 text-right shrink-0 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-[13px] text-white/85 truncate">{ex.exercise.name}</span>
                    <span className="text-[12px] text-white/45 shrink-0">
                      {ex.sets}×{ex.reps !== null ? ex.reps : `${ex.duration_seconds}s`}
                    </span>
                  </div>
                ))}
                {exerciseCount > 4 && (
                  <p className="text-[11px] text-white/40 mt-2">+{exerciseCount - 4} ejercicios más</p>
                )}
              </div>
              {nutritionTotal > 0 && (
                <Link
                  href="/my-nutrition"
                  className="block mt-4 pt-3.5 border-t border-white/10 hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold">Nutrición de hoy</p>
                    <span className="text-[11px] font-semibold text-white/75 tabular-nums">
                      {nutritionCompleted}<span className="text-white/40">/{nutritionTotal}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mealEntries.map((entry) => {
                      const done = entry.status === 'completed';
                      return (
                        <span
                          key={entry.id}
                          className={`flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-full ${
                            done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-white/40'
                          }`}
                        >
                          {done && <Check className="w-[10px] h-[10px]" strokeWidth={2.5} />}
                          {mealLabels[entry.meal_block] ?? entry.meal_block}
                        </span>
                      );
                    })}
                  </div>
                </Link>
              )}
              <div className="mt-4 space-y-2">
                <Link
                  href="/mi-programa/hoy?start=1"
                  className="w-full h-12 bg-kore-red rounded-xl flex items-center justify-center gap-2 font-semibold text-[14px] text-white hover:bg-[#C20000] transition-colors active:scale-95"
                >
                  Iniciar rutina <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </Link>
                <Link
                  href="/book-session"
                  className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-medium text-[13px] text-white/85 hover:bg-white/[0.12] transition-colors active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
                >
                  <Calendar className="w-3.5 h-3.5" strokeWidth={2} /> Agendar sesión
                </Link>
              </div>
            </div>
          </AnimatedHero>
        ) : (
          <AnimatedHero>
            <div className="p-5 py-8 text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold mb-3">
                Hoy · {todayProgDay?.day_type === 'active_rest' ? 'Descanso activo' : 'Descanso'}
              </p>
              <p className="font-heading text-[22px] font-semibold text-white">Día de recuperación</p>
              <p className="text-[13px] text-white/55 mt-2">Descansa, estira y prepárate para mañana.</p>
              <Link
                href="/book-session"
                className="inline-flex items-center gap-2 mt-5 h-11 px-5 rounded-xl font-medium text-[13px] text-white/85 hover:bg-white/[0.12] transition-colors active:scale-95"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                <Calendar className="w-3.5 h-3.5" strokeWidth={2} /> Agendar sesión
              </Link>
            </div>
          </AnimatedHero>
        )}

        {/* Next session */}
        {!isGuestDashboard && (
          <SessionCard
            mobile
            formattedDate={formattedDate}
            formattedTime={formattedTime}
            sessionInDays={sessionInDays}
            trainerName={trainerName}
            sessionObjective={upcomingReminder?.session_objective}
            expanded={sessionExpanded}
            onToggle={() => setSessionExpanded((v) => !v)}
            onShowUpcoming={() => setShowUpcoming(true)}
          />
        )}

        {/* Mi progreso + Resumen mensual */}
        <ProgressTabsCard mobileExpanded={progressExpanded} onToggleMobile={() => setProgressExpanded((v) => !v)} />

        {/* Evaluation cards */}
        <RealEvalGrid
          posturoEvals={posturoEvals}
          anthroEvals={anthroEvals}
          physicalEvals={physicalEvals}
          parqAssessments={parqAssessments}
          todayMood={todayMood}
          motivationMessage={koreIndex?.kore_message}
          gridClass="grid-cols-2"
          mobile
        />
      </div>

      {/* ════════════════ DESKTOP LAYOUT ════════════════ */}
      <div className="hidden xl:block px-10 pt-8 pb-16">

        {/* Header + streak */}
        <div className="flex items-end justify-between mb-7 gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-1.5">
              Tu espacio
            </p>
            <h1 className="font-heading text-[32px] font-semibold text-kore-wine-dark leading-tight">
              {getGreeting()}, {user.name.split(' ')[0]}.
            </h1>
            <p className="text-[14px] text-kore-gray-dark/55 mt-1.5">
              {todayProgDay ? `Día ${todayProgDay.day_number} de ${activeProgram?.days?.length ?? 0}` : 'Sin programa activo'} · {streakCount} días consecutivos
            </p>
          </div>
          <div className="flex items-stretch gap-2 shrink-0">
            <div
              className="rounded-xl px-3.5 py-2 min-w-[180px]"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(229,229,229,0.6)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-kore-red" strokeWidth={2} />
                  <span className="text-[13px] font-semibold text-kore-gray-dark">{streakCount} días</span>
                </div>
                <span className="text-[10px] text-kore-gray-dark/45 tabular-nums font-semibold">
                  {streakCount}/{longestStreak || '—'}
                </span>
              </div>
              <div className="h-1 bg-kore-gray-dark/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${longestStreak > 0 ? Math.min((streakCount / longestStreak) * 100, 100) : 0}%`,
                    background: 'linear-gradient(to right, #E00000, #9A0526)',
                  }}
                />
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-xl px-3"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(229,229,229,0.6)' }}
              aria-label="Récord de racha"
            >
              <Trophy className="w-4 h-4 text-amber-500" strokeWidth={2} />
              <span className="text-[14px] font-bold text-kore-gray-dark tabular-nums">
                {longestStreak || '—'}
              </span>
            </div>
            {koreIndex?.kore_score !== null && koreIndex?.kore_score !== undefined && (
              <Link
                href="/my-diagnosis"
                className="flex items-center gap-1.5 rounded-xl px-3 hover:bg-white/70 transition-colors active:scale-95"
                style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(229,229,229,0.6)' }}
                aria-label="Tu calificación KÓRE"
              >
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/55">KÓRE</span>
                <span className={`text-[14px] font-bold tabular-nums ${scoreColorClass}`}>
                  {koreIndex.kore_score}
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Row 1: Hero (8) + Sesión (4) */}
        <div className="grid grid-cols-12 gap-5 mb-5">
          <div className="col-span-8">
            <AnimatedHero>
              {hasRoutine ? (
                <div className="grid gap-7 p-8" style={{ gridTemplateColumns: '1fr 300px' }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: '#E7C8A0' }}>
                      {dayLabel} · Día {todayProgDay?.day_number}
                    </p>
                    <h2
                      className="font-heading text-[42px] font-semibold mb-2.5"
                      style={{ color: '#FFF8EC', lineHeight: 1.05, letterSpacing: '-0.015em' }}
                    >
                      ¿Listo para<br />entrenar?
                    </h2>
                    <p className="text-[14px] mb-6" style={{ color: '#FFE9DC', opacity: 0.8 }}>
                      {exerciseCount} ejercicios · ~{estimatedMin} min
                    </p>
                    <div className="flex gap-2.5">
                      <Link
                        href="/mi-programa/hoy?start=1"
                        className="h-[50px] px-6 bg-kore-red text-white rounded-xl font-semibold text-[14px] flex items-center gap-2 hover:bg-[#C20000] transition-colors active:scale-95"
                        style={{ boxShadow: '0 6px 16px rgba(224,0,0,0.4)' }}
                      >
                        <Play className="w-4 h-4" fill="white" strokeWidth={0} /> Iniciar rutina
                      </Link>
                      <Link
                        href="/book-session"
                        className="h-[50px] px-[18px] text-white rounded-xl font-medium text-[13px] flex items-center gap-2 hover:bg-white/[0.12] transition-colors active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
                      >
                        <Calendar className="w-3.5 h-3.5" strokeWidth={2} /> Agendar sesión
                      </Link>
                    </div>
                    {nutritionTotal > 0 && (
                      <Link
                        href="/my-nutrition"
                        className="block mt-6 pt-5 border-t border-white/10 hover:opacity-90 transition-opacity"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold">Nutrición de hoy</p>
                          <span className="text-[12px] font-semibold text-white/75 tabular-nums">
                            {nutritionCompleted}<span className="text-white/40"> / {nutritionTotal}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {mealEntries.map((entry) => {
                            const done = entry.status === 'completed';
                            return (
                              <span
                                key={entry.id}
                                className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                                  done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-white/40'
                                }`}
                              >
                                {done && <Check className="w-[11px] h-[11px]" strokeWidth={2.5} />}
                                {mealLabels[entry.meal_block] ?? entry.meal_block}
                              </span>
                            );
                          })}
                        </div>
                      </Link>
                    )}
                  </div>
                  <div style={{ borderLeft: '1px solid rgba(255,255,255,0.10)', paddingLeft: 24 }}>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] mb-2.5">En esta sesión</p>
                    <div className="space-y-0">
                      {allExercises.slice(0, 8).map((ex, i) => (
                        <div key={ex.id} className="flex items-center gap-2.5 py-1.5">
                          <span className="text-[11px] text-white/30 w-5 text-right shrink-0 tabular-nums">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="flex-1 text-[12px] text-white/82 truncate min-w-0">{ex.exercise.name}</span>
                          <span className="text-[11px] text-white/40 shrink-0">
                            {ex.sets}×{ex.reps !== null ? ex.reps : `${ex.duration_seconds}s`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8">
                  <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: '#E7C8A0' }}>Hoy</p>
                  <h2 className="font-heading text-[42px] font-semibold" style={{ color: '#FFF8EC', lineHeight: 1.05, letterSpacing: '-0.015em' }}>
                    Día de descanso
                  </h2>
                  <p className="text-[14px] mt-2" style={{ color: '#FFE9DC', opacity: 0.7 }}>Descansa, hidrátate y prepárate para mañana.</p>
                  <Link
                    href="/book-session"
                    className="inline-flex items-center gap-2 mt-6 h-[50px] px-[18px] text-white rounded-xl font-medium text-[13px] hover:bg-white/[0.12] transition-colors active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
                  >
                    <Calendar className="w-3.5 h-3.5" strokeWidth={2} /> Agendar sesión
                  </Link>
                </div>
              )}
            </AnimatedHero>
          </div>

          <div className="col-span-4">
            {!isGuestDashboard ? (
              <SessionCard
                className="h-full"
                formattedDate={formattedDate}
                formattedTime={formattedTime}
                sessionInDays={sessionInDays}
                trainerName={trainerName}
                sessionObjective={upcomingReminder?.session_objective}
                onShowUpcoming={() => setShowUpcoming(true)}
              />
            ) : (
              <div className="rounded-[22px] p-6 bg-white/70 border border-white/60 h-full flex items-center justify-center text-center">
                <p className="text-sm text-kore-gray-dark/40">Modo invitado activo</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Mi Progreso / Resumen (full width) */}
        <div className="mb-5">
          <ProgressTabsCard />
        </div>

        {/* Row 3: Evaluation cards */}
        {(posturoEvals.length > 0 || anthroEvals.length > 0 || physicalEvals.length > 0) && (
          <div className="mb-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-2.5">
              Resultados de tus evaluaciones
            </p>
            <RealEvalGrid
              posturoEvals={posturoEvals}
              anthroEvals={anthroEvals}
              physicalEvals={physicalEvals}
              parqAssessments={parqAssessments}
              todayMood={todayMood}
              motivationMessage={koreIndex?.kore_message}
              gridClass="grid-cols-4"
            />
          </div>
        )}

      </div>

      {/* Mensaje del entrenador — mini-card anclada abajo */}
      <TrainerMessageBanner />
    </section>
  );
}
