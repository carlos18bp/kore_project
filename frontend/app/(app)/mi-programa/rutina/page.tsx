'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
import { useWorkoutCaptures } from '@/lib/hooks/useWorkoutCaptures';
import YouTubeEmbed from '@/app/components/program/YouTubeEmbed';

type Phase = 'intro' | 'countdown' | 'execute' | 'rest' | 'complete';

const RUTINA_HERO_STYLES = `
  @keyframes rutina-orb-1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.15)}}
  @keyframes rutina-orb-2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,40px) scale(0.9)}}
  @keyframes rutina-orb-3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,30px) scale(1.1)}}
  @keyframes rutina-aurora{0%,100%{opacity:0.45}50%{opacity:0.85}}
  @keyframes rutina-shell-fade{from{opacity:0}to{opacity:1}}
`;

function RutinaShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="fixed inset-0 z-[55] overflow-y-auto overflow-x-hidden"
      style={{
        background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
        animation: 'rutina-shell-fade 280ms ease-out both',
      }}
    >
      <style>{RUTINA_HERO_STYLES}</style>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 80% 20%, rgba(255,233,220,0.20) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(20,5,12,0.65) 0%, transparent 55%)',
          animation: 'rutina-aurora 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '12%', right: '8%', width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)',
          filter: 'blur(40px)', animation: 'rutina-orb-1 9s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '8%', left: '12%', width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)',
          filter: 'blur(50px)', animation: 'rutina-orb-2 11s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '48%', right: '38%', width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,194,156,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)', animation: 'rutina-orb-3 13s ease-in-out infinite',
        }}
      />
      <div className="relative z-10 min-h-full">
        {children}
      </div>
    </section>
  );
}

function TimerRing({ remaining, total, size = 160 }: { remaining: number; total: number; size?: number }) {
  const cx = size / 2;
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (total > 0 ? remaining / total : 0));
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${remaining}s`;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ position: 'absolute', inset: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#E00000" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black text-white" style={{ fontSize: size * 0.22 }}>{label}</span>
      </div>
    </div>
  );
}

export default function RutinaPage() {
  const router = useRouter();
  const { todayData, todayLoading, fetchTodayData, updateExerciseStatus } = useProgramStore();

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

  useEffect(() => { fetchTodayData(); }, [fetchTodayData]);

  // Derived data (computed at top level so the conditional effects below can reference
  // current exercise/set without violating Rules of Hooks).
  const exerciseLogs = useMemo(() => {
    if (!todayData?.daily_log) return [];
    return [...todayData.daily_log.exercise_logs].sort(
      (a, b) => a.program_exercise.order - b.program_exercise.order,
    );
  }, [todayData]);
  const currentLog = exerciseLogs[exIdx];
  const pe = currentLog?.program_exercise;
  const ex = pe?.exercise;

  // ── Workout camera validation (credits engine) ────────────────────────────
  const { value: creditValue, requireWorkoutCaptures, fetchValues } = useCreditValuesStore();
  useEffect(() => { fetchValues(); }, [fetchValues]);

  const [gateOpen, setGateOpen] = useState(false);
  const executeWindowMs = ((pe?.duration_seconds ?? 45) + 15) * 1000;
  const captures = useWorkoutCaptures({
    active: phase === 'execute' && requireWorkoutCaptures,
    logId: todayData?.daily_log?.id ?? null,
    exLogId: currentLog?.id ?? null,
    windowMs: executeWindowMs,
  });

  // First visit with the rule active and no stored decision → consent gate.
  useEffect(() => {
    if (requireWorkoutCaptures && captures.permission === 'unknown') setGateOpen(true);
  }, [requireWorkoutCaptures, captures.permission]);

  // Intro animation
  useEffect(() => {
    if (phase !== 'intro') return;
    const tl = gsap.timeline();
    if (slideRef.current) tl.fromTo(slideRef.current, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    if (titleRef.current) tl.fromTo(titleRef.current, { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, '-=0.3');
    if (musclesRef.current && musclesRef.current.children.length > 0)
      tl.fromTo(Array.from(musclesRef.current.children), { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, stagger: 0.07, ease: 'power2.out' }, '-=0.2');
    if (metaRef.current) tl.fromTo(metaRef.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' }, '-=0.15');
    if (ctaRef.current) tl.fromTo(ctaRef.current, { y: 24, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }, '-=0.1');
    return () => { tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exIdx]);

  // Countdown animation (3 · 2 · 1 · ¡Ya!)
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (!countRef.current) return;
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

  // Execute timer (counts down when the exercise has a duration)
  useEffect(() => {
    if (phase !== 'execute') return;
    if (!pe?.duration_seconds || execRemaining <= 0) return;
    const id = setInterval(() => setExecRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, execRemaining > 0, pe?.duration_seconds]);

  // Rest timer (between sets)
  useEffect(() => {
    if (phase !== 'rest') return;
    if (restRemaining <= 0) return;
    const id = setInterval(() => {
      setRestRemaining((r) => {
        if (r <= 1) { clearInterval(id); setTimeout(() => setPhase('countdown'), 0); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restRemaining > 0]);

  const handleClose = () => router.push('/mi-programa');

  if (todayLoading || !todayData) {
    return (
      <RutinaShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white" />
        </div>
      </RutinaShell>
    );
  }

  const { program_day, daily_log } = todayData;

  if (!daily_log || program_day.exercises.length === 0) {
    return (
      <RutinaShell>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
          <p className="text-4xl">😴</p>
          <p className="text-lg font-bold text-white">No hay ejercicios para hoy</p>
          <button onClick={handleClose} className="text-sm text-white/55 hover:text-white/80 transition-colors">← Volver al programa</button>
        </div>
      </RutinaShell>
    );
  }

  // Consent gate for the camera validation — shown before the routine flow.
  if (gateOpen) {
    return (
      <RutinaShell>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
          <div className="text-5xl">🎥</div>
          <h2 className="font-heading text-[24px] font-semibold" style={{ color: '#FFF8EC' }}>
            Validación de tu rutina
          </h2>
          <p className="text-[14px] max-w-sm" style={{ color: '#FFE9DC', opacity: 0.8 }}>
            Durante tu entrenamiento se tomará un video para validar el cumplimiento de tu rutina
            y entregarte tus créditos cuando tu entrenador lo valide.
          </p>
          {creditValue('workout_day') !== null && (
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300">
              +{creditValue('workout_day')} créditos por rutina validada
            </span>
          )}
          <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
            <button
              onClick={async () => { await captures.requestPermission(); setGateOpen(false); }}
              className="bg-[#E00000] hover:bg-[#C20000] text-white font-semibold px-8 py-3.5 rounded-2xl transition-colors active:scale-95 text-[14px]"
            >
              Activar cámara
            </button>
            <button
              onClick={() => { captures.decline(); setGateOpen(false); }}
              className="text-[13px] py-2" style={{ color: '#FFE9DC', opacity: 0.6 }}
            >
              Entrenar sin validar
            </button>
          </div>
        </div>
      </RutinaShell>
    );
  }

  const total = exerciseLogs.length;
  const completedCount = exerciseLogs.filter((el) => el.status === 'completed').length;
  const skippedCount = exerciseLogs.filter((el) => el.status === 'skipped').length;

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
      updateExerciseStatus(daily_log.id, currentLog.id, 'completed');
      advanceExercise();
    } else {
      setSetIdx((s) => s + 1);
      setRestRemaining(pe.rest_seconds || 60);
      setPhase('rest');
    }
  };

  const handleSkip = () => {
    if (!currentLog) return;
    updateExerciseStatus(daily_log.id, currentLog.id, 'skipped');
    advanceExercise();
  };

  // ── COMPLETE ───────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <RutinaShell>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <div className="text-6xl mb-5">🎉</div>
          <h2 className="font-heading text-[28px] xl:text-[36px] font-semibold leading-[1.05] mb-2" style={{ color: '#FFF8EC', letterSpacing: '-0.015em' }}>¡Sesión completada!</h2>
          <p className="text-[14px] mb-8" style={{ color: '#FFE9DC', opacity: 0.75 }}>Terminaste tu rutina del día</p>
          <div className="flex gap-3 mb-8">
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-6 py-4 backdrop-blur-sm">
              <p className="font-heading text-[28px] font-bold text-emerald-400 leading-none">{completedCount}</p>
              <p className="text-[10.5px] text-emerald-300/70 uppercase tracking-[0.14em] font-semibold mt-1.5">Completados</p>
            </div>
            {skippedCount > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-6 py-4 backdrop-blur-sm">
                <p className="font-heading text-[28px] font-bold text-amber-400 leading-none">{skippedCount}</p>
                <p className="text-[10.5px] text-amber-300/70 uppercase tracking-[0.14em] font-semibold mt-1.5">Omitidos</p>
              </div>
            )}
          </div>
          {requireWorkoutCaptures && captures.permission === 'granted' && creditValue('workout_day') !== null && (
            <p className="text-[12px] mb-6" style={{ color: '#FFE9DC', opacity: 0.7 }}>
              📸 Rutina en validación · +{creditValue('workout_day')} créditos cuando tu entrenador la apruebe
            </p>
          )}
          <button
            onClick={handleClose}
            className="bg-[#E00000] hover:bg-[#C20000] text-white font-semibold px-8 py-3.5 rounded-2xl transition-colors active:scale-95 text-[14px]"
          >
            Ver mi programa
          </button>
        </div>
      </RutinaShell>
    );
  }

  if (!currentLog || !pe || !ex) return null;

  const primaryMuscles = ex.primary_muscles
    ? ex.primary_muscles.split(',').map((m) => m.trim()).filter(Boolean)
    : [];
  const repsLabel = pe.reps ? `${pe.reps} reps` : pe.duration_seconds ? `${pe.duration_seconds}s` : '—';

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <RutinaShell>
        <div className="min-h-screen flex flex-col">
          <div className="flex items-center justify-between px-5 pt-6 xl:pt-10 pb-3 shrink-0">
            <button onClick={handleClose} aria-label="Cerrar rutina"
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center hover:bg-white/15 transition-colors active:scale-95">
              <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex gap-1.5 items-center">
              {exerciseLogs.map((_, i) => (
                <div key={i} className="rounded-full transition-all duration-400" style={{
                  width: i === exIdx ? 20 : 6, height: 6,
                  background: i < exIdx ? 'rgba(255,255,255,0.4)' : i === exIdx ? '#E00000' : 'rgba(255,255,255,0.15)',
                }} />
              ))}
            </div>
            <div className="w-10" />
          </div>

        <div ref={slideRef} className="flex-1 overflow-y-auto px-5 pb-40">
          <div className="max-w-sm mx-auto pt-2">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-3">
              Ejercicio {exIdx + 1} de {total}
            </p>
            <h1 ref={titleRef} className="text-3xl font-black text-white leading-tight mb-6">{ex.name}</h1>

            {primaryMuscles.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2.5 font-semibold">Músculos</p>
                <div ref={musclesRef} className="flex flex-wrap gap-2">
                  {primaryMuscles.map((m) => (
                    <span key={m} className="text-sm font-medium text-white/80 px-3 py-1.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div ref={metaRef} className="rounded-2xl p-4 mb-5 flex gap-0"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex-1 text-center">
                <p className="text-2xl font-black text-white">{pe.sets}</p>
                <p className="text-[10px] text-white/35 mt-0.5">Series</p>
              </div>
              <div className="w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
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

            {ex.pattern && (
              <div className="flex gap-2 mb-5">
                <span className="text-xs font-semibold text-[#E00000] px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(224,0,0,0.12)' }}>{ex.pattern}</span>
                {ex.is_corrective && (
                  <span className="text-xs font-semibold text-blue-400 px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(96,165,250,0.12)' }}>Correctivo</span>
                )}
              </div>
            )}

            {requireWorkoutCaptures && creditValue('workout_day') !== null && (
              <span className="inline-block mb-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                +{creditValue('workout_day')} al validar tu entrenador
              </span>
            )}

            {ex.youtube_url && (
              <div className="mb-5">
                <YouTubeEmbed url={ex.youtube_url} title={ex.name} />
              </div>
            )}
          </div>
        </div>

          <div ref={ctaRef} className="fixed bottom-0 left-0 right-0 z-10 px-5 pb-8 pt-6"
            style={{ background: 'linear-gradient(to top, #2D0F1A 65%, transparent)' }}>
            <div className="max-w-sm mx-auto space-y-2">
              <button onClick={() => setPhase('countdown')}
                className="w-full bg-[#E00000] text-white font-semibold py-4 rounded-2xl text-[15px] hover:bg-[#C20000] transition-colors shadow-lg active:scale-95">
                Entendido, ¡vamos! →
              </button>
              <button onClick={handleSkip} className="w-full text-white/35 hover:text-white/55 transition-colors text-[13px] py-1.5">
                Omitir ejercicio
              </button>
            </div>
          </div>
        </div>
      </RutinaShell>
    );
  }

  // ── COUNTDOWN ──────────────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <RutinaShell>
        <div className="min-h-screen flex flex-col items-center justify-center select-none">
          <p className="text-[10.5px] text-white/55 uppercase tracking-[0.18em] mb-10 font-semibold">Prepárate</p>
          <span ref={countRef} className="font-heading font-black text-white leading-none block text-center"
            style={{ fontSize: 'clamp(80px, 30vw, 140px)' }}>3</span>
          <p className="text-[14px] text-white/55 mt-10 px-6 text-center">{ex.name}</p>
        </div>
      </RutinaShell>
    );
  }

  // ── EXECUTE ────────────────────────────────────────────────────────────────
  if (phase === 'execute') {
    const timerDone = pe.duration_seconds ? execRemaining <= 0 : true;

    return (
      <RutinaShell>
        <video ref={captures.videoRef} muted playsInline className="fixed w-px h-px opacity-0 pointer-events-none" />
        {captures.capturing && (
          <span className="fixed top-20 right-5 z-20 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Validando rutina
          </span>
        )}
        {requireWorkoutCaptures && captures.permission === 'denied' && (
          <button
            onClick={() => setGateOpen(true)}
            className="fixed top-20 right-5 z-20 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300"
          >
            Sin validación · no suma créditos
          </button>
        )}
        <div className="min-h-screen flex flex-col">
          <div className="flex items-center justify-between px-5 pt-6 xl:pt-10 pb-3 shrink-0">
            <button onClick={handleClose} aria-label="Cerrar rutina"
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center hover:bg-white/15 transition-colors active:scale-95">
              <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p className="text-[12px] text-white/55 font-medium text-center flex-1 px-2 truncate">{ex.name}</p>
            <p className="text-[12px] font-bold shrink-0 tabular-nums" style={{ color: '#E00000' }}>{setIdx + 1} / {pe.sets}</p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            {pe.duration_seconds ? (
              <>
                <TimerRing remaining={execRemaining} total={pe.duration_seconds} size={200} />
                {timerDone && <p className="text-[13px] font-semibold text-kore-red animate-pulse">¡Tiempo!</p>}
              </>
            ) : (
              <div className="flex flex-col items-center">
                <span className="font-heading font-black text-white leading-none" style={{ fontSize: 'clamp(72px, 28vw, 120px)' }}>
                  {pe.reps}
                </span>
                <p className="text-white/55 text-[14px] mt-2">repeticiones</p>
              </div>
            )}
            <p className="text-[11px] text-white/45 uppercase tracking-[0.14em] font-semibold">
              {pe.sets - setIdx - 1 > 0
                ? `${pe.sets - setIdx - 1} ${pe.sets - setIdx - 1 === 1 ? 'serie' : 'series'} restantes`
                : 'Última serie'}
            </p>
          </div>

          <div className="px-5 pb-10 space-y-2 max-w-sm mx-auto w-full">
            <button onClick={handleCompleteSet}
              className={`w-full py-4 rounded-2xl font-semibold text-[15px] transition-all active:scale-95 ${
                timerDone
                  ? 'text-white shadow-lg'
                  : 'text-white border border-white/15 hover:border-white/30'
              }`}
              style={timerDone
                ? { background: 'linear-gradient(135deg, #E00000 0%, #9A0526 100%)', boxShadow: '0 8px 24px -8px rgba(224,0,0,0.45)' }
                : { background: 'rgba(224,0,0,0.10)' }
              }>
              ✓ Completé el set
            </button>
            <button onClick={handleSkip} className="w-full text-white/35 hover:text-white/55 transition-colors text-[13px] py-1.5">
              Omitir ejercicio
            </button>
          </div>
        </div>
      </RutinaShell>
    );
  }

  // ── REST ───────────────────────────────────────────────────────────────────
  if (phase === 'rest') {
    return (
      <RutinaShell>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: '#E7C8A0' }}>Descansa</p>
          <p className="font-heading text-[20px] xl:text-[24px] font-semibold leading-tight" style={{ color: '#FFF8EC' }}>
            Siguiente: serie {setIdx + 1} de {pe.sets}
          </p>
          <TimerRing remaining={restRemaining} total={pe.rest_seconds || 60} size={160} />
          <button
            onClick={() => { setRestRemaining(0); setPhase('countdown'); }}
            className="mt-2 text-[13px] font-semibold text-white/70 hover:text-white transition-colors px-5 py-2.5 rounded-xl bg-white/5 border border-white/15 hover:border-white/25 active:scale-95">
            Listo, continuar
          </button>
        </div>
      </RutinaShell>
    );
  }

  return null;
}
