'use client';

import { useEffect, useState } from 'react';
import { useParqStore, type ParqAssessment, type ParqFormData } from '@/lib/stores/parqStore';
import TrainerNoteHero from '@/app/components/shared/TrainerNoteHero';

/* ──────────────────────────────────────────────────────────────────────────
 *  Constants
 *  ────────────────────────────────────────────────────────────────────── */

const KORE = {
  wineDark: '#670F22',
  ivory: '#FFF8EC',
  cream: '#FFE9DC',
  gold: '#E7C8A0',
  goldDeep: '#C9A77A',
  sage: '#A8C29C',
  sageSoft: '#B8D0A8',
  sakura: '#F4C7C7',
  sakuraDeep: '#E4A8A8',
  amber: '#E5C97A',
};

type ClassificationMeta = {
  label: string;
  color: string;
  bg: string;
  border: string;
  stamp: string;
  subtitle: string;
  story: string;
};

const CLASSIFICATIONS: Record<string, ClassificationMeta> = {
  green: {
    label: 'Apto sin restricciones',
    color: KORE.sage,
    bg: 'rgba(168,194,156,0.18)',
    border: 'rgba(168,194,156,0.40)',
    stamp: 'APTO',
    subtitle: 'Puedes realizar actividad física sin requerimientos adicionales.',
    story: 'No reportaste factores de riesgo. Entrenas con normalidad — tu trainer ajusta progresión según rendimiento.',
  },
  yellow: {
    label: 'Apto con precaución',
    color: KORE.amber,
    bg: 'rgba(229,201,122,0.18)',
    border: 'rgba(229,201,122,0.40)',
    stamp: 'CON PRECAUCIÓN',
    subtitle: 'Tu trainer adapta intensidad y carga con base en tu historial.',
    story: 'Reportaste 1–2 factores. Significa que entrenas con normalidad — tu trainer modula carga y atiende esos puntos específicos.',
  },
  red: {
    label: 'Requiere valoración médica',
    color: KORE.sakuraDeep,
    bg: 'rgba(228,168,168,0.22)',
    border: 'rgba(228,168,168,0.44)',
    stamp: 'VALORACIÓN',
    subtitle: 'Recomendamos consulta médica antes de iniciar el plan.',
    story: 'Reportaste 3+ factores. Antes de avanzar el plan, te pedimos confirmación médica para cuidar tu seguridad.',
  },
};

const QUESTIONS: { key: keyof Omit<ParqFormData, 'additional_notes'>; text: string; detail: string }[] = [
  {
    key: 'q1_heart_condition',
    text: '¿Algún médico le ha dicho que tiene una condición cardíaca o presión arterial alta?',
    detail: 'Hipertensión, enfermedad coronaria, arritmias u otra condición cardiovascular.',
  },
  {
    key: 'q2_chest_pain',
    text: '¿Siente dolor en el pecho en reposo, en actividades diarias, o al hacer actividad física?',
    detail: 'Dolor, presión o molestia en el pecho en cualquier momento.',
  },
  {
    key: 'q3_dizziness',
    text: '¿Pierde el equilibrio por mareos o ha perdido el conocimiento en los últimos 12 meses?',
    detail: 'Episodios de vértigo, desmayo o pérdida de consciencia reciente.',
  },
  {
    key: 'q4_chronic_condition',
    text: '¿Le han diagnosticado alguna condición médica crónica?',
    detail: 'Diferente a cardíaca/hipertensión. Ej.: diabetes, EPOC, artritis, cáncer, enfermedad renal.',
  },
  {
    key: 'q5_prescribed_medication',
    text: '¿Actualmente toma medicamentos recetados para una condición médica crónica?',
    detail: 'Cualquier medicamento recetado para una condición de salud persistente.',
  },
  {
    key: 'q6_bone_joint_problem',
    text: '¿Tiene un problema óseo, articular o de tejidos blandos que podría empeorar con actividad física?',
    detail: 'En los últimos 12 meses: huesos, articulaciones, ligamentos o tendones.',
  },
  {
    key: 'q7_medical_supervision',
    text: '¿Algún médico le ha dicho que solo debe hacer actividad física con supervisión médica?',
    detail: 'Recomendación explícita de un profesional de salud sobre supervisión durante el ejercicio.',
  },
];

const INITIAL_FORM: ParqFormData = {
  q1_heart_condition: false,
  q2_chest_pain: false,
  q3_dizziness: false,
  q4_chronic_condition: false,
  q5_prescribed_medication: false,
  q6_bone_joint_problem: false,
  q7_medical_supervision: false,
  additional_notes: '',
};

const HERO_KEYFRAMES = `
  @keyframes parq-mist-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(50px,-40px) scale(1.1); } }
  @keyframes parq-mist-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,40px) scale(1.05); } }
  @keyframes parq-petal-a { 0%,100% { transform: translate(0,0) rotate(0deg); } 33% { transform: translate(8px,-12px) rotate(8deg); } 66% { transform: translate(-6px,-6px) rotate(-5deg); } }
  @keyframes parq-petal-b { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-10px,12px) rotate(-12deg); } }
  @keyframes parq-stamp-in { 0% { transform: scale(1.4) rotate(-12deg); opacity: 0; } 60% { transform: scale(0.92) rotate(-9deg); opacity: 1; } 100% { transform: scale(1) rotate(-8deg); opacity: 1; } }
`;

/* ──────────────────────────────────────────────────────────────────────────
 *  Helpers
 *  ────────────────────────────────────────────────────────────────────── */

function classificationFromColor(color: string): ClassificationMeta {
  return CLASSIFICATIONS[color] || CLASSIFICATIONS.green;
}

function formatDate(iso: string | null | undefined, full = false) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', full
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthYear(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Stamp — animated rotated stamp graphic
 *  ────────────────────────────────────────────────────────────────────── */

function ResultStamp({ assessment }: { assessment: ParqAssessment }) {
  const c = classificationFromColor(assessment.risk_color);
  const validUntil = addDays(assessment.created_at, 90);
  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{
        padding: '32px 24px',
        borderRadius: 24,
        background: 'rgba(255,248,236,0.92)',
        border: `2px solid ${c.color}55`,
        boxShadow: `0 12px 32px -16px ${c.color}66, inset 0 1px 0 rgba(255,255,255,0.8)`,
        minHeight: 280,
      }}
    >
      <div className="relative inline-block" style={{ animation: 'parq-stamp-in 800ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div
          className="relative"
          style={{
            padding: '14px 28px',
            border: `3px solid ${c.color}`,
            borderRadius: 8,
            color: c.color,
            fontFamily: 'var(--font-heading), serif',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textShadow: `0 1px 0 ${c.color}33`,
            background: `${c.color}10`,
          }}
        >
          {c.stamp}
          <div className="absolute" style={{ top: -6, left: 8, right: 8, height: 1, background: c.color, opacity: 0.5 }} />
          <div className="absolute" style={{ bottom: -6, left: 8, right: 8, height: 1, background: c.color, opacity: 0.5 }} />
        </div>
      </div>
      <p
        className="font-heading text-center mt-6 font-semibold"
        style={{ color: KORE.wineDark, fontSize: 22, letterSpacing: '0.005em' }}
      >
        {c.label}
      </p>
      <p className="text-center text-[13px] mt-2.5 leading-[1.55]" style={{ color: 'rgba(103,15,34,0.65)', maxWidth: 320 }}>
        {c.subtitle}
      </p>
      <div
        className="flex items-center gap-5 mt-5 pt-4 w-full justify-center"
        style={{ borderTop: '1px solid rgba(103,15,34,0.10)' }}
      >
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.50)' }}>Firmado</p>
          <p className="font-heading text-[14px] font-semibold mt-0.5" style={{ color: KORE.wineDark }}>{formatDate(assessment.created_at)}</p>
        </div>
        <div style={{ width: 1, height: 30, background: 'rgba(103,15,34,0.15)' }} />
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.50)' }}>Vigente hasta</p>
          <p className="font-heading text-[14px] font-semibold mt-0.5" style={{ color: KORE.wineDark }}>{formatDate(validUntil)}</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Hero
 *  ────────────────────────────────────────────────────────────────────── */

function Hero({ assessment }: { assessment: ParqAssessment }) {
  const c = classificationFromColor(assessment.risk_color);
  const validUntil = addDays(assessment.created_at, 90);
  const yesCount = assessment.yes_count;
  const headlinePrimary =
    yesCount === 0 ? 'Tu cuerpo está listo' : yesCount <= 2 ? 'Tu cuerpo está listo' : 'Confirmación médica antes de avanzar';
  const headlineSecondary = yesCount <= 2 ? 'para entrenar.' : '';

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
      <div className="absolute pointer-events-none" style={{ top: '-20%', right: '-12%', width: 580, height: 580, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,233,220,0.20) 0%, rgba(244,199,199,0.10) 40%, transparent 65%)', filter: 'blur(80px)', animation: 'parq-mist-a 22s ease-in-out infinite' }} />
      <div className="absolute pointer-events-none" style={{ bottom: '-25%', left: '-15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,5,12,0.65) 0%, transparent 65%)', filter: 'blur(90px)', animation: 'parq-mist-b 26s ease-in-out infinite' }} />
      <svg style={{ position: 'absolute', top: 28, right: 80, width: 28, height: 28, opacity: 0.55, animation: 'parq-petal-a 14s ease-in-out infinite', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.sakura} opacity="0.9" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 70, right: 320, width: 22, height: 22, opacity: 0.45, animation: 'parq-petal-b 20s ease-in-out infinite reverse', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.gold} opacity="0.85" />
      </svg>
      <div className="absolute pointer-events-none" style={{ top: 0, left: 32, right: 32, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(231,200,160,0.5) 50%, transparent 100%)' }} />
      <svg className="absolute pointer-events-none" style={{ bottom: -40, right: -40, width: 200, height: 200, opacity: 0.06 }} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke={KORE.gold} strokeWidth="1.5" strokeDasharray="220 40" />
      </svg>

      <div className="relative grid gap-10 xl:gap-14 xl:grid-cols-[1.2fr_1fr] items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.22em', color: KORE.gold }}>Cuestionario PAR-Q+</p>
          <h2
            className="font-heading font-semibold leading-[1.05] mt-3.5"
            style={{ color: KORE.ivory, fontSize: 'clamp(36px, 5vw, 56px)', letterSpacing: '-0.01em', textShadow: '0 2px 16px rgba(244,199,199,0.18)' }}
          >
            {headlinePrimary}
            {headlineSecondary && <><br />{headlineSecondary}</>}
          </h2>
          <p className="text-[14px] xl:text-[15px] leading-[1.7] mt-4 max-w-lg" style={{ color: KORE.cream, opacity: 0.95 }}>
            Respondiste{' '}
            <strong style={{ color: KORE.gold, fontWeight: 600 }}>
              {yesCount} {yesCount === 1 ? 'sí' : 'síes'} de 7
            </strong>
            . Eso te ubica en banda{' '}
            <strong style={{ color: c.color, fontWeight: 600 }}>{c.label.toLowerCase()}</strong>
            . {c.story}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
            <div className="max-sm:col-span-2" style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.20)' }}>
              <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: KORE.gold }}>Respuestas afirmativas</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="font-heading font-semibold leading-none tabular-nums" style={{ color: KORE.ivory, fontSize: 36 }}>{yesCount}</span>
                <span className="text-[12px]" style={{ color: 'rgba(255,233,220,0.65)' }}>/ 7</span>
              </div>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.20)' }}>
              <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: KORE.gold }}>Vigencia</p>
              <p className="font-heading text-[17px] font-semibold mt-1.5" style={{ color: KORE.ivory }}>90 días</p>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.20)' }}>
              <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: KORE.gold }}>Próxima revisión</p>
              <p className="font-heading text-[17px] font-semibold mt-1.5 capitalize" style={{ color: KORE.ivory }}>{formatMonthYear(validUntil)}</p>
            </div>
          </div>
        </div>
        <ResultStamp assessment={assessment} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Questions list (read-only)
 *  ────────────────────────────────────────────────────────────────────── */

function QuestionsList({ assessment }: { assessment: ParqAssessment }) {
  const answers: Record<string, boolean> = {
    q1_heart_condition: assessment.q1_heart_condition,
    q2_chest_pain: assessment.q2_chest_pain,
    q3_dizziness: assessment.q3_dizziness,
    q4_chronic_condition: assessment.q4_chronic_condition,
    q5_prescribed_medication: assessment.q5_prescribed_medication,
    q6_bone_joint_problem: assessment.q6_bone_joint_problem,
    q7_medical_supervision: assessment.q7_medical_supervision,
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(24px, 3vw, 36px)',
        border: '1px solid rgba(103,15,34,0.08)',
        boxShadow: '0 4px 20px -12px rgba(45,15,26,0.15)',
      }}
    >
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Tus respuestas</p>
        <h2 className="font-heading text-2xl font-semibold mt-1.5" style={{ color: KORE.wineDark }}>Las 7 preguntas</h2>
      </div>
      <div className="flex flex-col gap-2.5">
        {QUESTIONS.map((q, i) => {
          const yes = answers[q.key];
          return (
            <div
              key={q.key}
              className="grid items-start gap-x-4 gap-y-2 grid-cols-[32px_minmax(0,1fr)_96px]"
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: yes ? 'rgba(229,201,122,0.10)' : 'rgba(255,255,255,0.65)',
                border: yes ? '1px solid rgba(229,201,122,0.35)' : '1px solid rgba(103,15,34,0.06)',
              }}
            >
              <span className="font-heading text-[11px] font-semibold" style={{ color: 'rgba(103,15,34,0.45)', letterSpacing: '0.18em' }}>0{i + 1}</span>
              <div className="min-w-0 max-sm:col-span-3 max-sm:order-last">
                <p className="text-[13px] leading-[1.55]" style={{ color: '#3A2128' }}>{q.text}</p>
                <p className="text-[11px] mt-1" style={{ color: 'rgba(103,15,34,0.5)' }}>{q.detail}</p>
              </div>
              <div
                className="grid grid-cols-2 overflow-hidden self-start max-sm:col-start-3"
                style={{
                  borderRadius: 8,
                  background: 'rgba(103,15,34,0.05)',
                  border: '1px solid rgba(103,15,34,0.10)',
                  height: 32,
                }}
              >
                <div
                  className="flex items-center justify-center text-[11px] font-bold"
                  style={{
                    letterSpacing: '0.10em',
                    background: yes ? 'linear-gradient(135deg, #E5C97A, #C9A85E)' : 'transparent',
                    color: yes ? KORE.ivory : 'rgba(103,15,34,0.40)',
                    textShadow: yes ? '0 1px 0 rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  SÍ
                </div>
                <div
                  className="flex items-center justify-center text-[11px] font-bold"
                  style={{
                    letterSpacing: '0.10em',
                    background: !yes ? 'linear-gradient(135deg, #A8C29C, #87A879)' : 'transparent',
                    color: !yes ? KORE.ivory : 'rgba(103,15,34,0.40)',
                    textShadow: !yes ? '0 1px 0 rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  NO
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {assessment.additional_notes && assessment.additional_notes.trim() !== '' && (
        <div
          className="mt-5"
          style={{
            padding: '16px 18px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(103,15,34,0.04), rgba(231,200,160,0.10))',
            border: '1px solid rgba(103,15,34,0.08)',
          }}
        >
          <p className="text-[10px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.20em', color: KORE.wineDark }}>Notas adicionales</p>
          <p className="text-[13px] leading-[1.6] italic" style={{ color: '#3A2128' }}>{assessment.additional_notes}</p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  History
 *  ────────────────────────────────────────────────────────────────────── */

function History({ assessments, onNew }: { assessments: ParqAssessment[]; onNew: () => void }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(24px, 3vw, 36px)',
        border: '1px solid rgba(103,15,34,0.08)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Historial</p>
          <h2 className="font-heading text-2xl font-semibold mt-1.5" style={{ color: KORE.wineDark }}>Tus PAR-Q+ anteriores</h2>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="font-semibold text-[12px] active:scale-95 transition-transform"
          style={{
            padding: '10px 18px',
            borderRadius: 11,
            background: 'rgba(255,255,255,0.7)',
            color: KORE.wineDark,
            border: '1px solid rgba(103,15,34,0.15)',
          }}
        >
          Hacer nuevo PAR-Q+
        </button>
      </div>
      <div className="relative" style={{ paddingLeft: 24 }}>
        <div
          className="absolute"
          style={{
            left: 7, top: 8, bottom: 8, width: 1,
            background: 'linear-gradient(180deg, transparent 0%, rgba(103,15,34,0.20) 12%, rgba(103,15,34,0.20) 88%, transparent 100%)',
          }}
        />
        {assessments.map((a, i) => {
          const c = classificationFromColor(a.risk_color);
          const isLatest = i === 0;
          return (
            <div
              key={a.id}
              className="relative grid items-center gap-5 flex-wrap"
              style={{
                gridTemplateColumns: 'minmax(140px, 160px) 1fr',
                paddingBottom: i < assessments.length - 1 ? 18 : 0,
              }}
            >
              <span
                className="absolute"
                style={{
                  left: -23, top: 14, width: 16, height: 16, borderRadius: 8,
                  background: isLatest ? `radial-gradient(circle, ${c.color}, ${c.color}88)` : KORE.ivory,
                  border: `2px solid ${c.color}`,
                  boxShadow: isLatest ? `0 0 0 5px ${c.color}22` : 'none',
                }}
              />
              <div>
                <p className="font-heading text-[17px] font-semibold" style={{ color: KORE.wineDark }}>{formatDate(a.created_at, true)}</p>
                {isLatest && (
                  <p className="text-[10px] font-bold uppercase mt-1" style={{ letterSpacing: '0.18em', color: c.color }}>● Vigente</p>
                )}
              </div>
              <div
                className="flex items-center gap-3.5"
                style={{
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                }}
              >
                <span className="font-heading text-[22px] font-bold tabular-nums" style={{ color: c.color, letterSpacing: '0.06em' }}>
                  {a.yes_count}/7
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: c.color }}>Resultado</p>
                  <p className="font-heading text-[14px] font-semibold mt-0.5 truncate" style={{ color: KORE.wineDark }}>{c.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Closing notes
 *  ────────────────────────────────────────────────────────────────────── */

function ClosingNote({ assessment }: { assessment: ParqAssessment }) {
  const c = classificationFromColor(assessment.risk_color);
  const messageByRisk: Record<string, string> = {
    green: 'Sin restricciones detectadas. Tu trainer ajusta el plan según rendimiento — sin precauciones especiales.',
    yellow: 'No es una restricción, es contexto. Tu trainer modula carga y volumen considerando lo que reportaste.',
    red: 'La consulta médica primero. Una vez confirmado, retomamos el plan con la guía adecuada para tu condición.',
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div
        style={{
          padding: 'clamp(20px, 3vw, 32px)',
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(103,15,34,0.04), rgba(231,200,160,0.10))',
          border: '1px solid rgba(103,15,34,0.08)',
        }}
      >
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: KORE.wineDark }}>Lo que esto significa</p>
        <p className="font-heading text-xl xl:text-[22px] font-semibold mt-2.5 leading-[1.4]" style={{ color: KORE.wineDark }}>
          “{messageByRisk[assessment.risk_color] || messageByRisk.green}”
        </p>
        <p className="text-[12px] italic mt-3.5" style={{ color: 'rgba(103,15,34,0.6)' }}>— Tu trainer adapta el plan a tu contexto.</p>
      </div>
      <div
        style={{
          padding: 24,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(103,15,34,0.08)',
        }}
      >
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Base científica</p>
        <p className="text-[12px] leading-[1.65] mt-2.5" style={{ color: '#3A2128' }}>
          El <strong style={{ color: KORE.wineDark }}>PAR-Q+</strong> (Physical Activity Readiness Questionnaire) es el cuestionario de tamizaje preactividad recomendado por la <strong style={{ color: KORE.wineDark }}>CSEP</strong> y avalado por la <strong style={{ color: KORE.wineDark }}>ACSM</strong>. Identifica condiciones que requieren ajuste o consulta médica antes de entrenar.
        </p>
        <p className="text-[11px] mt-3 italic" style={{ color: 'rgba(103,15,34,0.55)' }}>Vigencia recomendada · 90 días desde la última declaración.</p>
        {/* Status pill */}
        <div className="mt-3.5">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase"
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color, letterSpacing: '0.10em' }}
          >
            ● {c.label}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Inline form (used when there's no assessment OR user clicks "Hacer nuevo")
 *  ────────────────────────────────────────────────────────────────────── */

function ParqForm({
  form, onChange, submitting, error, onSubmit, onCancel, isUpdate,
}: {
  form: ParqFormData;
  onChange: (next: ParqFormData) => void;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
  onCancel: () => void;
  isUpdate: boolean;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.78)',
        borderRadius: 28,
        padding: 'clamp(24px, 3vw, 36px)',
        border: '1px solid rgba(103,15,34,0.08)',
        boxShadow: '0 4px 20px -12px rgba(45,15,26,0.18)',
      }}
    >
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Cuestionario PAR-Q+</p>
        <h2 className="font-heading text-2xl font-semibold mt-1.5" style={{ color: KORE.wineDark, letterSpacing: '-0.01em' }}>
          {isUpdate ? 'Hacer nuevo PAR-Q+' : 'Tu primer PAR-Q+'}
        </h2>
        <p className="text-[12.5px] mt-1.5 leading-[1.55]" style={{ color: 'rgba(103,15,34,0.65)' }}>
          Responde Sí o No a cada pregunta con honestidad. Esta información es confidencial y se usa para adaptar tu programa de forma segura.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {QUESTIONS.map((q, i) => {
          const yes = form[q.key];
          return (
            <div
              key={q.key}
              className="grid items-start gap-4"
              style={{
                gridTemplateColumns: '32px 1fr 130px',
                padding: '14px 16px',
                borderRadius: 14,
                background: yes ? 'rgba(229,201,122,0.10)' : 'rgba(255,248,236,0.50)',
                border: yes ? '1px solid rgba(229,201,122,0.35)' : '1px solid rgba(103,15,34,0.06)',
                transition: 'background 200ms, border-color 200ms',
              }}
            >
              <span className="font-heading text-[11px] font-semibold" style={{ color: 'rgba(103,15,34,0.45)', letterSpacing: '0.18em' }}>0{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold leading-[1.5]" style={{ color: KORE.wineDark }}>{q.text}</p>
                <p className="text-[11px] mt-1" style={{ color: 'rgba(103,15,34,0.55)' }}>{q.detail}</p>
              </div>
              <div className="grid grid-cols-2 gap-1 self-start">
                <button
                  type="button"
                  onClick={() => onChange({ ...form, [q.key]: true })}
                  className="text-[11px] font-bold transition-all active:scale-95"
                  style={{
                    padding: '8px 0',
                    borderRadius: 8,
                    background: yes ? 'linear-gradient(135deg, #E5C97A, #C9A85E)' : 'rgba(103,15,34,0.05)',
                    color: yes ? KORE.ivory : 'rgba(103,15,34,0.55)',
                    border: yes ? '1px solid rgba(201,168,94,0.5)' : '1px solid rgba(103,15,34,0.10)',
                    letterSpacing: '0.10em',
                    textShadow: yes ? '0 1px 0 rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  SÍ
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...form, [q.key]: false })}
                  className="text-[11px] font-bold transition-all active:scale-95"
                  style={{
                    padding: '8px 0',
                    borderRadius: 8,
                    background: !yes ? 'linear-gradient(135deg, #A8C29C, #87A879)' : 'rgba(103,15,34,0.05)',
                    color: !yes ? KORE.ivory : 'rgba(103,15,34,0.55)',
                    border: !yes ? '1px solid rgba(135,168,121,0.5)' : '1px solid rgba(103,15,34,0.10)',
                    letterSpacing: '0.10em',
                    textShadow: !yes ? '0 1px 0 rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  NO
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div className="mt-5">
        <label className="text-[10px] font-bold uppercase block mb-2" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.55)' }}>
          Notas adicionales (opcional)
        </label>
        <textarea
          value={form.additional_notes}
          onChange={(e) => onChange({ ...form, additional_notes: e.target.value })}
          rows={3}
          placeholder="¿Algún detalle adicional sobre tu estado de salud?"
          className="w-full text-[13px] resize-none"
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(103,15,34,0.12)',
            color: '#3A2128',
            outline: 'none',
            lineHeight: 1.55,
          }}
        />
      </div>

      {error && (
        <div
          className="mt-4 px-4 py-3 rounded-xl text-[12px] leading-[1.5]"
          style={{
            background: 'rgba(228,168,168,0.18)',
            border: '1px solid rgba(228,168,168,0.4)',
            color: '#9A0526',
          }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2.5 mt-5 pt-4" style={{ borderTop: '1px solid rgba(103,15,34,0.08)' }}>
        {isUpdate && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] font-semibold active:scale-95 transition-transform"
            style={{
              padding: '11px 18px',
              borderRadius: 12,
              background: 'rgba(103,15,34,0.05)',
              color: KORE.wineDark,
            }}
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className="text-[12px] font-semibold text-white active:scale-95 transition-transform disabled:opacity-60"
          style={{
            padding: '11px 22px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
            boxShadow: '0 4px 12px -4px rgba(154,5,38,0.4)',
          }}
        >
          {submitting ? 'Guardando…' : 'Enviar PAR-Q+'}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Main page
 *  ────────────────────────────────────────────────────────────────────── */

export default function MyParqPage() {
  const { assessments, loading, submitting, error, fetchMyAssessments, createAssessment } = useParqStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ParqFormData>(INITIAL_FORM);

  useEffect(() => {
    fetchMyAssessments();
  }, [fetchMyAssessments]);

  const latest = assessments[0] ?? null;

  const handleSubmit = async () => {
    const result = await createAssessment(form);
    if (result) {
      setShowForm(false);
      setForm(INITIAL_FORM);
    }
  };

  const lastDate = latest ? formatDate(latest.created_at, true) : '';

  return (
    <section className="min-h-screen bg-kore-cream">
      <style>{HERO_KEYFRAMES}</style>
      <div className="px-5 xl:px-10 pt-6 xl:pt-10 pb-20 mx-auto" style={{ maxWidth: 1280 }}>
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Tu salud</p>
            <h1
              className="font-heading text-3xl xl:text-4xl font-semibold mt-2 leading-tight"
              style={{ color: KORE.wineDark, letterSpacing: '-0.015em' }}
            >
              PAR-Q+
            </h1>
            <p className="text-[13px] text-kore-gray-dark/60 mt-1.5">
              {latest
                ? `Última declaración · ${lastDate} · ${assessments.length} ${assessments.length === 1 ? 'registro' : 'registros'}`
                : 'Cuestionario de Preparación para la Actividad Física'}
            </p>
          </div>
          {latest && !showForm && (
            <button
              type="button"
              onClick={() => { setShowForm(true); setForm(INITIAL_FORM); }}
              className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-[12px] active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
                boxShadow: '0 4px 12px -4px rgba(154,5,38,0.4)',
              }}
            >
              Hacer nuevo PAR-Q+
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && !latest && (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        )}

        {/* No assessment yet → form prominent */}
        {!loading && !latest && !showForm && (
          <div
            className="mt-4 mb-6 text-center max-w-xl mx-auto"
            style={{
              padding: 'clamp(28px, 4vw, 40px)',
              borderRadius: 24,
              background: 'rgba(255,255,255,0.78)',
              border: '1px solid rgba(103,15,34,0.08)',
              boxShadow: '0 4px 20px -12px rgba(45,15,26,0.15)',
            }}
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-full grid place-items-center text-2xl" style={{ background: 'rgba(103,15,34,0.06)' }}>📋</div>
            <h2 className="font-heading text-xl font-semibold" style={{ color: KORE.wineDark }}>Tu PAR-Q+ aún no está hecho</h2>
            <p className="text-[13px] mt-2 leading-[1.55]" style={{ color: 'rgba(103,15,34,0.65)' }}>
              Tarda menos de 2 minutos. Es el filtro de seguridad que define cómo arranca tu plan.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-[13px] active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
                boxShadow: '0 4px 12px -4px rgba(154,5,38,0.4)',
              }}
            >
              Completar PAR-Q+
            </button>
          </div>
        )}

        {/* Form view */}
        {showForm && (
          <ParqForm
            form={form}
            onChange={setForm}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setForm(INITIAL_FORM); }}
            isUpdate={!!latest}
          />
        )}

        {/* Hero + content when latest exists and form is hidden */}
        {!showForm && latest && (
          <>
            <TrainerNoteHero
              className="mb-6"
              note={latest.additional_notes ?? ''}
              date={latest.created_at}
            />

            <Hero assessment={latest} />

            <div className="mt-8">
              <QuestionsList assessment={latest} />
            </div>

            {assessments.length > 1 && (
              <div className="mt-8">
                <History assessments={assessments} onNew={() => { setShowForm(true); setForm(INITIAL_FORM); }} />
              </div>
            )}

            <div className="mt-8">
              <ClosingNote assessment={latest} />
            </div>

            <div className="mt-10 text-center text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.40)' }}>
              KÓRE · PAR-Q+ · {lastDate}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
