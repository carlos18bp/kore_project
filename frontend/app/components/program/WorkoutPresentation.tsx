'use client';

import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { TodayData, ExerciseLog } from '@/lib/stores/programStore';
import YouTubeEmbed from './YouTubeEmbed';

type Phase = 'intro' | 'countdown' | 'execute' | 'rest' | 'complete';

type Props = {
  todayData: TodayData;
  onClose: () => void;
  onStatusChange: (exLogId: number, status: 'completed' | 'skipped' | 'not_done') => void;
};

const R = 52;
const CIRC = 2 * Math.PI * R;

function TimerRing({ remaining, total, size = 160 }: { remaining: number; total: number; size?: number }) {
  const cx = size / 2;
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const progress = total > 0 ? remaining / total : 0;
  const offset = circ * (1 - progress);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${remaining}s`;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ position: 'absolute', inset: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke="#E00000"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black text-white" style={{ fontSize: size * 0.22 }}>{label}</span>
      </div>
    </div>
  );
}

export default function WorkoutPresentation({ todayData, onClose, onStatusChange }: Props) {
  const { program_day, daily_log } = todayData;

  const exerciseLogs = [...daily_log.exercise_logs].sort(
    (a, b) => a.program_exercise.order - b.program_exercise.order,
  );
  const total = exerciseLogs.length;

  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [execRemaining, setExecRemaining] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);

  const slideRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const musclesRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  const currentLog = exerciseLogs[exIdx];
  const pe = currentLog?.program_exercise;
  const ex = pe?.exercise;

  const completedCount = exerciseLogs.filter((el) => el.status === 'completed').length;
  const skippedCount = exerciseLogs.filter((el) => el.status === 'skipped').length;

  // ── Intro slide animation ──
  useEffect(() => {
    if (phase !== 'intro') return;
    const tl = gsap.timeline();
    if (slideRef.current) {
      tl.fromTo(slideRef.current, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    }
    if (titleRef.current) {
      tl.fromTo(titleRef.current, { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, '-=0.3');
    }
    if (musclesRef.current && musclesRef.current.children.length > 0) {
      tl.fromTo(
        Array.from(musclesRef.current.children),
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, stagger: 0.07, ease: 'power2.out' },
        '-=0.2',
      );
    }
    if (metaRef.current) {
      tl.fromTo(metaRef.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' }, '-=0.15');
    }
    if (ctaRef.current) {
      tl.fromTo(ctaRef.current, { y: 24, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, '-=0.1');
    }
    return () => { tl.kill(); };
  }, [exIdx, phase]);

  // ── Countdown animation (single GSAP timeline, no state per digit) ──
  useEffect(() => {
    if (phase !== 'countdown' || !countRef.current) return;
    const el = countRef.current;
    const tl = gsap.timeline();

    ['3', '2', '1', '¡Ya!'].forEach((label) => {
      tl.call(() => { el.textContent = label; })
        .fromTo(el, { scale: 1.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' })
        .to(el, { scale: 0.5, opacity: 0, duration: 0.25, delay: label === '¡Ya!' ? 0.5 : 0.7, ease: 'power2.in' });
    });

    tl.call(() => {
      if (pe?.duration_seconds) setExecRemaining(pe.duration_seconds);
      setPhase('execute');
    });

    return () => { tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exIdx, setIdx]);

  // ── Execution timer ──
  useEffect(() => {
    if (phase !== 'execute' || !pe?.duration_seconds || execRemaining <= 0) return;
    const id = setInterval(() => {
      setExecRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exIdx, setIdx, execRemaining > 0]);

  // ── Rest timer ──
  useEffect(() => {
    if (phase !== 'rest' || restRemaining <= 0) return;
    const id = setInterval(() => {
      setRestRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          setTimeout(() => setPhase('countdown'), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restRemaining > 0]);

  const advanceExercise = () => {
    if (exIdx >= total - 1) {
      setPhase('complete');
    } else {
      setExIdx((i) => i + 1);
      setSetIdx(0);
      setPhase('intro');
    }
  };

  const handleCompleteSet = () => {
    if (!currentLog || !pe) return;
    if (setIdx + 1 >= pe.sets) {
      onStatusChange(currentLog.id, 'completed');
      advanceExercise();
    } else {
      setSetIdx((s) => s + 1);
      setRestRemaining(pe.rest_seconds || 60);
      setPhase('rest');
    }
  };

  const handleSkip = () => {
    if (!currentLog) return;
    onStatusChange(currentLog.id, 'skipped');
    advanceExercise();
  };

  // ─────────────────────────────────────────────────────
  // COMPLETE
  // ─────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-5">🎉</div>
        <h2 className="text-3xl font-black text-white mb-2">¡Sesión completada!</h2>
        <p className="text-zinc-500 mb-8 text-sm">Terminaste tu rutina del día</p>
        <div className="flex gap-3 mb-8">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-4">
            <p className="text-3xl font-black text-emerald-400">{completedCount}</p>
            <p className="text-xs text-emerald-500/70 mt-1">Completados</p>
          </div>
          {skippedCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-6 py-4">
              <p className="text-3xl font-black text-yellow-400">{skippedCount}</p>
              <p className="text-xs text-yellow-500/70 mt-1">Omitidos</p>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="bg-kore-red text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-kore-red/90 transition-colors"
        >
          Ver resumen
        </button>
      </div>
    );
  }

  if (!currentLog || !pe || !ex) return null;

  const primaryMuscles = ex.primary_muscles
    ? ex.primary_muscles.split(',').map((m) => m.trim()).filter(Boolean)
    : [];
  const repsLabel = pe.reps ? `${pe.reps} reps` : pe.duration_seconds ? `${pe.duration_seconds}s` : '—';

  // ─────────────────────────────────────────────────────
  // INTRO SLIDE
  // ─────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-safe-top pt-12 pb-3 shrink-0">
          <button onClick={onClose} className="p-2 -ml-2 text-white/30 hover:text-white/60 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Progress dots */}
          <div className="flex gap-1.5 items-center">
            {exerciseLogs.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-400"
                style={{
                  width: i === exIdx ? 20 : 6,
                  height: 6,
                  background: i < exIdx ? 'rgba(255,255,255,0.3)' : i === exIdx ? '#E00000' : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>
          <div className="w-9" />
        </div>

        {/* Slide content */}
        <div ref={slideRef} className="flex-1 overflow-y-auto px-5 pb-36">
          <div className="max-w-sm mx-auto pt-2">

            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-3">
              Ejercicio {exIdx + 1} de {total}
            </p>

            <h1 ref={titleRef} className="text-3xl font-black text-white leading-tight mb-6">
              {ex.name}
            </h1>

            {primaryMuscles.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2.5 font-semibold">Músculos</p>
                <div ref={musclesRef} className="flex flex-wrap gap-2">
                  {primaryMuscles.map((m) => (
                    <span
                      key={m}
                      className="text-sm font-medium text-white/80 bg-white/8 border border-white/10 px-3 py-1.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div
              ref={metaRef}
              className="rounded-2xl p-4 mb-5 flex gap-0"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex-1 text-center">
                <p className="text-2xl font-black text-white">{pe.sets}</p>
                <p className="text-[10px] text-white/35 mt-0.5">Series</p>
              </div>
              <div className="w-px bg-white/8" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex-1 text-center">
                <p className="text-2xl font-black text-white">{repsLabel}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{pe.reps ? 'Reps' : 'Duración'}</p>
              </div>
              <div className="w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex-1 text-center">
                <p className="text-2xl font-black text-white">{pe.rest_seconds}s</p>
                <p className="text-[10px] text-white/35 mt-0.5">Descanso</p>
              </div>
            </div>

            {/* Pattern */}
            {ex.pattern && (
              <div className="flex gap-2 mb-5">
                <span className="text-xs font-semibold text-[#E00000] px-2.5 py-1 rounded-full" style={{ background: 'rgba(224,0,0,0.12)' }}>
                  {ex.pattern}
                </span>
                {ex.is_corrective && (
                  <span className="text-xs font-semibold text-blue-400 px-2.5 py-1 rounded-full" style={{ background: 'rgba(96,165,250,0.12)' }}>
                    Correctivo
                  </span>
                )}
              </div>
            )}

            {/* Video — visible por defecto */}
            {ex.youtube_url && (
              <div className="mb-5">
                <YouTubeEmbed url={ex.youtube_url} title={ex.name} />
              </div>
            )}

          </div>
        </div>

        {/* Sticky CTA */}
        <div
          ref={ctaRef}
          className="fixed bottom-0 left-0 right-0 z-[61] px-5 pb-8 pt-5"
          style={{ background: 'linear-gradient(to top, #09090b 60%, transparent)' }}
        >
          <div className="max-w-sm mx-auto space-y-2">
            <button
              onClick={() => setPhase('countdown')}
              className="w-full bg-[#E00000] text-white font-black py-4 rounded-2xl text-base hover:bg-[#C20000] transition-colors shadow-lg"
            >
              Entendido, ¡vamos! →
            </button>
            <button onClick={handleSkip} className="w-full text-white/25 hover:text-white/45 transition-colors text-sm py-1.5">
              Omitir ejercicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // COUNTDOWN
  // ─────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col items-center justify-center select-none">
        <p className="text-xs text-white/25 uppercase tracking-widest mb-10 font-semibold">Prepárate</p>
        <span
          ref={countRef}
          className="font-black text-white leading-none block text-center"
          style={{ fontSize: 'clamp(80px, 30vw, 140px)' }}
        >
          3
        </span>
        <p className="text-sm text-white/25 mt-10 px-6 text-center">{ex.name}</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // EXECUTE
  // ─────────────────────────────────────────────────────
  if (phase === 'execute') {
    const timerDone = pe.duration_seconds ? execRemaining <= 0 : true;

    return (
      <div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col">

        <div className="flex items-center justify-between px-5 pt-12 pb-3 shrink-0">
          <button onClick={onClose} className="p-2 -ml-2 text-white/25 hover:text-white/50 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="text-xs text-white/40 font-medium text-center flex-1 px-2 truncate">{ex.name}</p>
          <p className="text-xs font-black shrink-0" style={{ color: '#E00000' }}>
            {setIdx + 1} / {pe.sets}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          {pe.duration_seconds ? (
            <>
              <TimerRing remaining={execRemaining} total={pe.duration_seconds} size={200} />
              {timerDone && (
                <p className="text-sm font-semibold text-emerald-400 animate-pulse">¡Tiempo!</p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center">
              <span className="font-black text-white leading-none" style={{ fontSize: 'clamp(72px, 28vw, 120px)' }}>
                {pe.reps}
              </span>
              <p className="text-zinc-500 text-lg mt-1">repeticiones</p>
            </div>
          )}
          <p className="text-xs text-white/25">
            {pe.sets - setIdx - 1 > 0
              ? `${pe.sets - setIdx - 1} ${pe.sets - setIdx - 1 === 1 ? 'serie' : 'series'} restantes`
              : 'Última serie'}
          </p>
        </div>

        <div className="px-5 pb-10 space-y-2 max-w-sm mx-auto w-full">
          <button
            onClick={handleCompleteSet}
            className={`w-full py-4 rounded-2xl font-black text-base transition-all ${
              timerDone
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg'
                : 'text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/50'
            }`}
            style={timerDone ? {} : { background: 'rgba(34,197,94,0.08)' }}
          >
            ✓ Completé el set
          </button>
          <button onClick={handleSkip} className="w-full text-white/20 hover:text-white/40 transition-colors text-sm py-1.5">
            Omitir ejercicio
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // REST
  // ─────────────────────────────────────────────────────
  if (phase === 'rest') {
    return (
      <div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Descansa</p>
        <p className="text-lg font-bold text-white">
          Siguiente: serie {setIdx + 1} de {pe.sets}
        </p>

        <TimerRing remaining={restRemaining} total={pe.rest_seconds || 60} size={160} />

        <button
          onClick={() => {
            setRestRemaining(0);
            setPhase('countdown');
          }}
          className="mt-2 text-sm font-semibold text-white/50 hover:text-white/80 transition-colors px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20"
        >
          Listo, continuar
        </button>
      </div>
    );
  }

  return null;
}
