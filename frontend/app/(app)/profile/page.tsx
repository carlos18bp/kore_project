'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import PasswordResetModal from '@/app/components/profile/PasswordResetModal';
import ImageLightbox from '@/app/components/shared/ImageLightbox';
import { GOAL_OPTIONS } from '@/app/components/profile/ProfileIcons';
import { api } from '@/lib/services/http';

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
  sakura: '#F4C7C7',
  sakuraDeep: '#E4A8A8',
  amber: '#E5C97A',
};

const SEX_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

const ID_TYPE_OPTIONS = [
  { value: 'cc', label: 'Cédula de ciudadanía' },
  { value: 'ce', label: 'Cédula de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'ti', label: 'Tarjeta de identidad' },
  { value: 'dni', label: 'DNI' },
];

const GOAL_DESCRIPTIONS: Record<string, string> = {
  fat_loss: 'Déficit moderado + cardio inteligente',
  muscle_gain: 'Hipertrofia progresiva + nutrición proteica',
  rehab: 'Movilidad, postura y reincorporación gradual',
  general_health: 'Equilibrio, energía y hábitos sostenibles',
  sports_performance: 'Potencia, velocidad y resistencia específicas',
};

const MOOD_LABELS = [
  'Muy bajo', 'Bajo', 'Apagado', 'Cansado', 'Estable',
  'Bien', 'Activo', 'Energético', 'Pleno', 'Imparable',
];

const HERO_KEYFRAMES = `
  @keyframes prof-mist-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(50px,-40px) scale(1.1); } }
  @keyframes prof-mist-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,40px) scale(1.05); } }
  @keyframes prof-petal-a { 0%,100% { transform: translate(0,0) rotate(0deg); } 33% { transform: translate(8px,-12px) rotate(8deg); } 66% { transform: translate(-6px,-6px) rotate(-5deg); } }
  @keyframes prof-petal-b { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-10px,12px) rotate(-12deg); } }
  @keyframes prof-avatar-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(244,199,199,0.40); } 50% { box-shadow: 0 0 0 14px rgba(244,199,199,0); } }
  .prof-input { width: 100%; padding: 12px 14px; border-radius: 11px; background: rgba(255,255,255,0.85); border: 1px solid rgba(103,15,34,0.12); font-size: 13px; color: #2A1A1F; outline: none; transition: border-color 120ms, box-shadow 120ms; }
  .prof-input:focus { border-color: #9A0526 !important; box-shadow: 0 0 0 3px rgba(154,5,38,0.10) !important; }
  .prof-input:disabled { background: rgba(103,15,34,0.04); color: rgba(103,15,34,0.45); cursor: not-allowed; }
`;

/* ──────────────────────────────────────────────────────────────────────────
 *  Helpers
 *  ────────────────────────────────────────────────────────────────────── */

function formatDateLong(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function calcAge(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

function getInitials(first: string, last: string): string {
  const f = (first || '').trim()[0] || '';
  const l = (last || '').trim()[0] || '';
  return (f + l).toUpperCase() || '?';
}

function getSexLabel(value: string): string {
  return SEX_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

function getIdTypeLabel(value: string): string {
  return ID_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

function getGoalLabel(value: string): string {
  return GOAL_OPTIONS.find((g) => g.value === value)?.label ?? '—';
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Atoms
 *  ────────────────────────────────────────────────────────────────────── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block mb-2"
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.20em',
        color: 'rgba(103,15,34,0.55)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </label>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-semibold"
      style={{
        fontSize: 10,
        letterSpacing: '0.22em',
        color: 'rgba(103,15,34,0.55)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </p>
  );
}

function CardTitle({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <h2
      className="font-heading font-semibold mt-1.5"
      style={{ color: KORE.wineDark, fontSize: large ? 24 : 20, letterSpacing: '-0.005em' }}
    >
      {children}
    </h2>
  );
}

function LightCard({ children, className = '', padding = 28 }: { children: React.ReactNode; className?: string; padding?: number }) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 24,
        padding,
        border: '1px solid rgba(103,15,34,0.08)',
        boxShadow: '0 4px 16px -10px rgba(45,15,26,0.10)',
      }}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Save toast
 *  ────────────────────────────────────────────────────────────────────── */

function SaveToast({ state }: { state: 'hidden' | 'typing' | 'saved' }) {
  const visible = state !== 'hidden';
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 pointer-events-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div
        className="flex items-center gap-2"
        style={{
          padding: '8px 16px',
          borderRadius: 999,
          background: KORE.ivory,
          border: state === 'typing' ? '1px solid rgba(229,201,122,0.40)' : '1px solid rgba(168,194,156,0.40)',
          boxShadow: '0 8px 24px -8px rgba(45,15,26,0.18)',
        }}
      >
        {state === 'typing' ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#A88A2E" strokeWidth="3" />
              <path className="opacity-75" fill="#A88A2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[11px] font-semibold" style={{ color: '#A88A2E' }}>Guardando…</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke={KORE.sageDeep}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-[11px] font-semibold" style={{ color: KORE.sageDeep }}>Guardado</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Hero
 *  ────────────────────────────────────────────────────────────────────── */

type HeroProps = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  avatarUrl: string | null;
  goalLabel: string | null;
  hasActiveSubscription: boolean;
  memberSinceLabel: string | null;
  onAvatarClick: () => void;
  onAvatarOpen: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function Hero({
  firstName, lastName, email, phone, city, avatarUrl, goalLabel,
  hasActiveSubscription, memberSinceLabel, onAvatarClick, onAvatarOpen, fileInputRef, onFileChange,
}: HeroProps) {
  const initials = getInitials(firstName, lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || email;

  return (
    <div
      className="relative overflow-hidden text-white"
      style={{
        borderRadius: 32,
        background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
        padding: 'clamp(24px, 4vw, 48px)',
        boxShadow: '0 30px 70px -25px rgba(45,15,26,0.55), inset 0 1px 0 rgba(255,233,220,0.12), 0 0 0 1px rgba(231,200,160,0.10)',
      }}
    >
      <div className="absolute pointer-events-none" style={{ top: '-20%', right: '-12%', width: 580, height: 580, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,233,220,0.20) 0%, rgba(244,199,199,0.10) 40%, transparent 65%)', filter: 'blur(80px)', animation: 'prof-mist-a 22s ease-in-out infinite' }} />
      <div className="absolute pointer-events-none" style={{ bottom: '-25%', left: '-15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,5,12,0.65) 0%, transparent 65%)', filter: 'blur(90px)', animation: 'prof-mist-b 26s ease-in-out infinite' }} />
      <svg style={{ position: 'absolute', top: 28, right: 80, width: 28, height: 28, opacity: 0.55, animation: 'prof-petal-a 14s ease-in-out infinite', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.sakura} opacity="0.9" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 60, right: 280, width: 22, height: 22, opacity: 0.45, animation: 'prof-petal-b 20s ease-in-out infinite reverse', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.gold} opacity="0.85" />
      </svg>
      <div className="absolute pointer-events-none" style={{ top: 0, left: 32, right: 32, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(231,200,160,0.5) 50%, transparent 100%)' }} />
      <svg className="absolute pointer-events-none" style={{ bottom: -40, right: -40, width: 200, height: 200, opacity: 0.06 }} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke={KORE.gold} strokeWidth="1.5" strokeDasharray="220 40" />
      </svg>

      <div className="relative flex flex-col md:flex-row items-center md:items-center gap-7 md:gap-8">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="absolute pointer-events-none"
            style={{
              inset: -8,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(244,199,199,0.20) 0%, transparent 70%)',
              filter: 'blur(12px)',
              animation: 'prof-avatar-glow 4s ease-in-out infinite',
            }}
          />
          <button
            type="button"
            onClick={onAvatarOpen}
            className="relative grid place-items-center cursor-pointer"
            style={{
              width: 116, height: 116, borderRadius: '50%',
              background: avatarUrl ? '#1A0A11' : 'linear-gradient(135deg, #F4C7C7, #E7C8A0)',
              fontFamily: 'var(--font-heading), serif',
              fontSize: 44, fontWeight: 600,
              color: '#5C2030',
              border: '3px solid rgba(255,248,236,0.35)',
              boxShadow: '0 12px 32px -8px rgba(45,15,26,0.4)',
              overflow: 'hidden',
            }}
            aria-label="Ver foto de perfil"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials
            )}
          </button>
          <button
            type="button"
            onClick={onAvatarClick}
            title="Cambiar foto"
            className="absolute grid place-items-center cursor-pointer"
            style={{
              bottom: -2, right: -2,
              width: 36, height: 36, borderRadius: 18,
              background: KORE.ivory,
              border: '2px solid #5C2030',
              color: '#5C2030',
              boxShadow: '0 4px 12px -4px rgba(0,0,0,0.3)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
        </div>

        {/* Identity block */}
        <div className="flex-1 min-w-0 text-center md:text-left">
          <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: '0.22em', color: KORE.gold }}>
            Tu espacio personal
          </p>
          <h2
            className="font-heading font-semibold mt-2.5 leading-[1.05]"
            style={{
              color: KORE.ivory,
              fontSize: 'clamp(28px, 5vw, 48px)',
              letterSpacing: '-0.005em',
              textShadow: '0 2px 16px rgba(244,199,199,0.18)',
            }}
          >
            {fullName}
          </h2>
          <div className="flex items-center justify-center md:justify-start gap-3 mt-3 flex-wrap text-[13px]" style={{ color: KORE.cream }}>
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 6l8 6 8-6" />
                <rect x="3" y="5" width="18" height="14" rx="2" />
              </svg>
              {email}
            </span>
            {phone && (
              <>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(231,200,160,0.45)' }} />
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M21 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 21 16.92z" />
                  </svg>
                  {phone}
                </span>
              </>
            )}
            {city && (
              <>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(231,200,160,0.45)' }} />
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {city}
                </span>
              </>
            )}
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-5">
            {hasActiveSubscription && (
              <span
                className="font-bold uppercase"
                style={{
                  padding: '6px 14px', borderRadius: 999,
                  background: 'rgba(168,194,156,0.22)',
                  color: KORE.sage,
                  border: '1px solid rgba(168,194,156,0.40)',
                  fontSize: 10, letterSpacing: '0.18em',
                }}
              >
                ● Plan activo
              </span>
            )}
            {memberSinceLabel && (
              <span
                className="font-bold uppercase"
                style={{
                  padding: '6px 14px', borderRadius: 999,
                  background: 'rgba(231,200,160,0.18)',
                  color: KORE.gold,
                  border: '1px solid rgba(231,200,160,0.40)',
                  fontSize: 10, letterSpacing: '0.18em',
                }}
              >
                Miembro desde {memberSinceLabel}
              </span>
            )}
            {goalLabel && goalLabel !== '—' && (
              <span
                className="font-bold uppercase"
                style={{
                  padding: '6px 14px', borderRadius: 999,
                  background: 'rgba(244,199,199,0.18)',
                  color: KORE.sakura,
                  border: '1px solid rgba(244,199,199,0.35)',
                  fontSize: 10, letterSpacing: '0.18em',
                }}
              >
                Objetivo: {goalLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Mood card (1–10 scale)
 *  ────────────────────────────────────────────────────────────────────── */

function MoodCard({
  initialScore, onSubmit,
}: {
  initialScore: number | null;
  onSubmit: (score: number) => void;
}) {
  const [mood, setMood] = useState<number | null>(initialScore);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMood(initialScore);
  }, [initialScore]);

  const handlePick = async (n: number) => {
    setMood(n);
    setSubmitting(true);
    try {
      await onSubmit(n);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LightCard padding={24}>
      <div className="mb-3.5">
        <Eyebrow>Tu día</Eyebrow>
        <CardTitle>¿Cómo te sientes hoy?</CardTitle>
        <p className="text-[12px] mt-1.5 leading-[1.5]" style={{ color: 'rgba(103,15,34,0.6)' }}>
          Del 1 al 10 — tu bienestar es parte del proceso.
        </p>
      </div>
      <div className="grid grid-cols-10 gap-1.5">
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
                borderRadius: 9,
                border: sel ? `2px solid #9A0526` : '1px solid rgba(103,15,34,0.12)',
                background: sel
                  ? `linear-gradient(135deg, rgba(244,199,199,${0.25 + intensity * 0.5}), rgba(231,200,160,${0.18 + intensity * 0.4}))`
                  : `rgba(255,248,236,${0.4 + intensity * 0.35})`,
                fontSize: 13,
                color: sel ? KORE.wineDark : 'rgba(103,15,34,0.55)',
                cursor: 'pointer',
                boxShadow: sel ? '0 4px 12px -4px rgba(154,5,38,0.30)' : 'none',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="text-center italic mt-3 text-[11px]" style={{ color: 'rgba(103,15,34,0.55)' }}>
        {mood
          ? `${MOOD_LABELS[mood - 1]} · Registrado para hoy`
          : 'Aún no has registrado tu estado de hoy.'}
      </p>
    </LightCard>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Summary card
 *  ────────────────────────────────────────────────────────────────────── */

function SummaryCard({
  age, dobLabel, city, eps, idType, idNumber, goalLabel,
}: {
  age: number | null;
  dobLabel: string;
  city: string;
  eps: string;
  idType: string;
  idNumber: string;
  goalLabel: string;
}) {
  const rows: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Edad', value: age !== null ? `${age} años` : '—' },
    { label: 'Fecha de nacimiento', value: dobLabel },
    { label: 'Ciudad', value: city || '—' },
    { label: 'EPS', value: eps || '—' },
    { label: 'Documento', value: idNumber ? `${getIdTypeLabel(idType).split(' ').map((w) => w[0]).join('').toUpperCase()} ${idNumber}` : '—' },
    { label: 'Objetivo', value: goalLabel, highlight: goalLabel !== '—' },
  ];

  return (
    <LightCard padding={24}>
      <Eyebrow>Resumen</Eyebrow>
      <CardTitle>De un vistazo</CardTitle>
      <div className="flex flex-col mt-4">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 py-3"
            style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(103,15,34,0.08)' }}
          >
            <span className="text-[12px]" style={{ color: 'rgba(103,15,34,0.65)' }}>{r.label}</span>
            <span
              className="font-heading text-right text-[13px] font-semibold tabular-nums"
              style={{ color: r.highlight ? '#9A0526' : KORE.wineDark }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </LightCard>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Main page
 *  ────────────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const { user } = useAuthStore();
  const {
    profile, todayMood, loading,
    fetchProfile, updateProfile, uploadAvatar, submitMood, clearMessages,
  } = useProfileStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', phone: '', sex: '',
    date_of_birth: '', eps: '', id_type: '', id_number: '',
    id_expedition_date: '', address: '', city: '', primary_goal: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [toastState, setToastState] = useState<'hidden' | 'typing' | 'saved'>('hidden');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCodeSending, setResetCodeSending] = useState(false);
  const [resetCodeMessage, setResetCodeMessage] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldRef = useRef<{ field: string; value: string } | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      const cp = profile.customer_profile;
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        sex: cp?.sex || '',
        date_of_birth: cp?.date_of_birth || '',
        eps: cp?.eps || '',
        id_type: cp?.id_type || '',
        id_number: cp?.id_number || '',
        id_expedition_date: cp?.id_expedition_date || '',
        address: cp?.address || '',
        city: cp?.city || '',
        primary_goal: cp?.primary_goal || '',
      });
      setAvatarPreview(cp?.avatar_url || null);
    }
  }, [profile]);

  const flushPendingSave = async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const pending = pendingFieldRef.current;
    pendingFieldRef.current = null;
    if (!pending) return;

    clearMessages();
    const dateFields = ['date_of_birth', 'id_expedition_date'];
    const payload: Record<string, string | null> = {};
    payload[pending.field] = dateFields.includes(pending.field) ? (pending.value || null) : pending.value;
    const result = await updateProfile(payload);
    if (result?.success) {
      setToastState('saved');
      setTimeout(() => setToastState('hidden'), 1800);
    } else {
      setToastState('hidden');
    }
  };

  const queueFieldSave = (field: string, value: string, immediate = false) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setToastState('typing');
    pendingFieldRef.current = { field, value };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (immediate) {
      void flushPendingSave();
    } else {
      debounceRef.current = setTimeout(() => {
        void flushPendingSave();
      }, 1000);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setToastState('typing');
    const result = await uploadAvatar(file);
    if (result.success && result.avatar_url) {
      setAvatarPreview(result.avatar_url);
      setToastState('saved');
      setTimeout(() => setToastState('hidden'), 1800);
    } else {
      setToastState('hidden');
    }
  };

  const handleResetPasswordRequest = async () => {
    if (!user?.email) return;
    setResetCodeSending(true);
    setResetCodeMessage('');
    try {
      await api.post('/auth/password-reset/request-code/', { email: user.email });
      setShowResetModal(true);
    } catch {
      setResetCodeMessage('Error al enviar el código. Intenta de nuevo.');
    } finally {
      setResetCodeSending(false);
    }
  };

  const handleSubmitMood = async (score: number) => {
    setToastState('typing');
    const result = await submitMood(score);
    if (result.success) {
      setToastState('saved');
      setTimeout(() => setToastState('hidden'), 1800);
    } else {
      setToastState('hidden');
    }
  };

  const goalLabel = useMemo(() => getGoalLabel(formData.primary_goal), [formData.primary_goal]);
  const age = useMemo(() => calcAge(formData.date_of_birth), [formData.date_of_birth]);
  const dobLabel = useMemo(() => formatDateLong(formData.date_of_birth), [formData.date_of_birth]);
  const memberSinceLabel = useMemo(() => {
    const iso = profile?.customer_profile?.kore_start_date;
    if (!iso) return null;
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
  }, [profile?.customer_profile?.kore_start_date]);

  if (!user || loading) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-kore-cream">
      <style>{HERO_KEYFRAMES}</style>
      <SaveToast state={toastState} />

      <div className="px-5 xl:px-10 pt-6 xl:pt-10 pb-20 mx-auto" style={{ maxWidth: 1280 }}>
        {/* HEADER */}
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Mi cuenta</p>
          <h1
            className="font-heading text-3xl xl:text-4xl font-semibold mt-2 leading-tight"
            style={{ color: KORE.wineDark, letterSpacing: '-0.015em' }}
          >
            Mi Perfil
          </h1>
          <p className="text-[13px] text-kore-gray-dark/60 mt-1.5">
            Mantén tu información al día — tu trainer la usa para personalizar tu plan.
          </p>
        </div>

        {/* HERO */}
        <Hero
          firstName={formData.first_name}
          lastName={formData.last_name}
          email={profile?.email || user.email}
          phone={formData.phone}
          city={formData.city}
          avatarUrl={avatarPreview}
          goalLabel={goalLabel}
          hasActiveSubscription={false /* derived elsewhere; left simple here */}
          memberSinceLabel={memberSinceLabel}
          fileInputRef={fileInputRef}
          onAvatarClick={() => fileInputRef.current?.click()}
          onAvatarOpen={() => avatarPreview && setLightboxOpen(true)}
          onFileChange={handleAvatarFile}
        />

        {/* GRID: sidebar + main */}
        <div
          className="mt-7 grid items-start gap-5"
          style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
        >
          <div className="grid gap-5 xl:grid-cols-[320px_1fr] items-start">
            {/* LEFT — sidebar */}
            <div className="flex flex-col gap-5">
              <MoodCard
                initialScore={todayMood?.score ?? null}
                onSubmit={handleSubmitMood}
              />
              <SummaryCard
                age={age}
                dobLabel={dobLabel}
                city={formData.city}
                eps={formData.eps}
                idType={formData.id_type}
                idNumber={formData.id_number}
                goalLabel={goalLabel}
              />
            </div>

            {/* RIGHT — main */}
            <div className="flex flex-col gap-5">
              {/* Personal info */}
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
                    <Eyebrow>Mi información</Eyebrow>
                    <CardTitle large>Datos personales</CardTitle>
                  </div>
                  <span className="text-[11px] italic" style={{ color: 'rgba(103,15,34,0.50)' }}>
                    Se guarda automáticamente
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Nombre</FieldLabel>
                    <input
                      className="prof-input"
                      value={formData.first_name}
                      onChange={(e) => queueFieldSave('first_name', e.target.value)}
                      onBlur={() => flushPendingSave()}
                    />
                  </div>
                  <div>
                    <FieldLabel>Apellido</FieldLabel>
                    <input
                      className="prof-input"
                      value={formData.last_name}
                      onChange={(e) => queueFieldSave('last_name', e.target.value)}
                      onBlur={() => flushPendingSave()}
                    />
                  </div>
                  <div>
                    <FieldLabel>Correo electrónico</FieldLabel>
                    <input className="prof-input" value={profile?.email || user.email} disabled type="email" />
                  </div>
                  <div>
                    <FieldLabel>Teléfono</FieldLabel>
                    <input
                      className="prof-input"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => queueFieldSave('phone', e.target.value)}
                      onBlur={() => flushPendingSave()}
                    />
                  </div>
                  <div>
                    <FieldLabel>Sexo</FieldLabel>
                    <select
                      className="prof-input"
                      value={formData.sex}
                      onChange={(e) => queueFieldSave('sex', e.target.value, true)}
                    >
                      <option value="">Seleccionar…</option>
                      {SEX_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Fecha de nacimiento</FieldLabel>
                    <input
                      className="prof-input"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => queueFieldSave('date_of_birth', e.target.value, true)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Dirección</FieldLabel>
                    <input
                      className="prof-input"
                      value={formData.address}
                      onChange={(e) => queueFieldSave('address', e.target.value)}
                      onBlur={() => flushPendingSave()}
                      placeholder="Tu dirección de residencia"
                    />
                  </div>
                  <div>
                    <FieldLabel>Ciudad</FieldLabel>
                    <input
                      className="prof-input"
                      value={formData.city}
                      onChange={(e) => queueFieldSave('city', e.target.value)}
                      onBlur={() => flushPendingSave()}
                    />
                  </div>
                  <div>
                    <FieldLabel>EPS</FieldLabel>
                    <input
                      className="prof-input"
                      value={formData.eps}
                      onChange={(e) => queueFieldSave('eps', e.target.value)}
                      onBlur={() => flushPendingSave()}
                    />
                  </div>
                </div>

                {/* ID block */}
                <div className="mt-7 pt-6" style={{ borderTop: '1px dashed rgba(103,15,34,0.15)' }}>
                  <Eyebrow>Documento de identidad</Eyebrow>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr] gap-4">
                    <div>
                      <FieldLabel>Tipo</FieldLabel>
                      <select
                        className="prof-input"
                        value={formData.id_type}
                        onChange={(e) => queueFieldSave('id_type', e.target.value, true)}
                      >
                        <option value="">Seleccionar…</option>
                        {ID_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Número</FieldLabel>
                      <input
                        className="prof-input"
                        value={formData.id_number}
                        onChange={(e) => queueFieldSave('id_number', e.target.value)}
                        onBlur={() => flushPendingSave()}
                      />
                    </div>
                    <div>
                      <FieldLabel>Fecha de expedición</FieldLabel>
                      <input
                        className="prof-input"
                        type="date"
                        value={formData.id_expedition_date}
                        onChange={(e) => queueFieldSave('id_expedition_date', e.target.value, true)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Goal */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.65)',
                  borderRadius: 28,
                  padding: 'clamp(20px, 3vw, 36px)',
                  border: '1px solid rgba(103,15,34,0.08)',
                }}
              >
                <div className="mb-5">
                  <Eyebrow>Mi meta principal</Eyebrow>
                  <CardTitle large>¿Hacia dónde entrenas?</CardTitle>
                  <p className="text-[13px] mt-2 leading-[1.55] max-w-2xl" style={{ color: 'rgba(103,15,34,0.6)' }}>
                    Selecciona tu objetivo principal — tu trainer ajusta el plan, los rangos calóricos y el tipo de evaluaciones.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {GOAL_OPTIONS.map((g) => {
                    const sel = formData.primary_goal === g.value;
                    const Icon = g.Icon;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => queueFieldSave('primary_goal', g.value, true)}
                        className="flex flex-col gap-2 text-left transition-all active:scale-[0.99]"
                        style={{
                          padding: 18,
                          borderRadius: 16,
                          background: sel
                            ? 'linear-gradient(135deg, rgba(244,199,199,0.30), rgba(231,200,160,0.18))'
                            : 'rgba(255,255,255,0.55)',
                          border: sel ? '2px solid #9A0526' : '1px solid rgba(103,15,34,0.10)',
                          cursor: 'pointer',
                          minHeight: 120,
                          boxShadow: sel ? '0 8px 20px -10px rgba(154,5,38,0.30)' : 'none',
                        }}
                      >
                        <span
                          className="grid place-items-center"
                          style={{
                            width: 32, height: 32, borderRadius: 10,
                            background: sel ? 'rgba(154,5,38,0.10)' : 'rgba(103,15,34,0.06)',
                            color: sel ? '#9A0526' : 'rgba(103,15,34,0.55)',
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span
                          className="font-heading"
                          style={{
                            fontSize: 14, fontWeight: 600,
                            color: sel ? '#9A0526' : KORE.wineDark,
                            lineHeight: 1.25,
                          }}
                        >
                          {g.label}
                        </span>
                        <span
                          className="text-[11px] leading-[1.5]"
                          style={{ color: 'rgba(103,15,34,0.55)' }}
                        >
                          {GOAL_DESCRIPTIONS[g.value] ?? ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.65)',
                  borderRadius: 28,
                  padding: 'clamp(20px, 2.5vw, 32px)',
                  border: '1px solid rgba(103,15,34,0.08)',
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 md:items-center">
                  <div>
                    <Eyebrow>Seguridad</Eyebrow>
                    <CardTitle>Protege tu cuenta</CardTitle>
                    <p className="text-[12.5px] mt-2 leading-[1.55] max-w-xl" style={{ color: 'rgba(103,15,34,0.65)' }}>
                      Para cambiar tu contraseña, te enviaremos un código de verificación a{' '}
                      <strong style={{ color: KORE.wineDark }}>{profile?.email || user.email}</strong>.
                    </p>
                    {resetCodeMessage && (
                      <p className="text-[11px] mt-2 font-semibold" style={{ color: '#9A0526' }}>{resetCodeMessage}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPasswordRequest}
                    disabled={resetCodeSending}
                    className="inline-flex items-center justify-center gap-2 text-[12px] font-semibold active:scale-95 transition-transform disabled:opacity-60"
                    style={{
                      padding: '12px 22px',
                      borderRadius: 12,
                      background: '#2A1A1F',
                      color: KORE.ivory,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    {resetCodeSending ? 'Enviando…' : 'Cambiar contraseña'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.40)' }}>
          KÓRE · Mi Perfil{memberSinceLabel ? ` · Miembro desde ${memberSinceLabel}` : ''}
        </div>
      </div>

      {showResetModal && user?.email && (
        <PasswordResetModal email={user.email} onClose={() => setShowResetModal(false)} />
      )}
      {avatarPreview && (
        <ImageLightbox
          src={avatarPreview}
          alt="Foto de perfil"
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </section>
  );
}
