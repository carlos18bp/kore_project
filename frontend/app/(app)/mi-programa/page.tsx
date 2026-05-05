'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useProgramStore } from '@/lib/stores/programStore';
import type { ProgramDay } from '@/lib/stores/programStore';
import ProgramCalendar from '@/app/components/program/ProgramCalendar';

const LEVEL_LABEL: Record<number, string> = {
  1: 'Fundacional', 2: 'Básico', 3: 'Intermedio', 4: 'Avanzado', 5: 'Elite',
};

const FITNESS_LEVELS = [
  { level: 1, name: 'Fundacional', color: 'text-slate-600',   bg: 'bg-slate-100',   fill: 'bg-slate-400',   training: '3 días / semana', detail: '5 ejercicios · 2×10 reps', description: 'Construyes hábitos de movimiento seguros. El foco es la técnica y la consistencia.' },
  { level: 2, name: 'Básico',      color: 'text-blue-600',    bg: 'bg-blue-100',    fill: 'bg-blue-400',    training: '3 días / semana', detail: '5–6 ejercicios · 3×10 reps', description: 'Mayor variedad de movimientos y cargas progresivas para construir fuerza real.' },
  { level: 3, name: 'Intermedio',  color: 'text-emerald-600', bg: 'bg-emerald-100', fill: 'bg-emerald-500', training: '4 días / semana', detail: '6 ejercicios · 3×12 reps', description: 'Tu cuerpo tolera más volumen. Empezamos a especializar el estímulo por objetivos.' },
  { level: 4, name: 'Avanzado',    color: 'text-amber-600',   bg: 'bg-amber-100',   fill: 'bg-amber-500',   training: '5 días / semana', detail: '7 ejercicios · 4×10 reps', description: 'Alto desempeño. Intensidad elevada con periodización más compleja.' },
  { level: 5, name: 'Elite',       color: 'text-red-600',     bg: 'bg-red-100',     fill: 'bg-red-500',     training: '5 días / semana', detail: '7–8 ejercicios · 4×12 reps', description: 'Máximo rendimiento. Programación de alto estímulo con variedad compleja.' },
] as const;
const GOAL_LABEL: Record<string, string> = {
  fat_loss: 'Pérdida de grasa', muscle_gain: 'Ganancia muscular',
  rehab: 'Rehabilitación', general_health: 'Salud general', sports_performance: 'Rendimiento deportivo',
};
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;
const DAY_TYPE_LABEL: Record<string, string> = {
  training: 'Día de entrenamiento', active_rest: 'Recuperación activa', rest: 'Día de descanso',
};
const DAY_TYPE_COLOR: Record<string, string> = {
  training: 'text-kore-red bg-kore-red/10',
  active_rest: 'text-teal-700 bg-teal-50',
  rest: 'text-kore-gray-dark/50 bg-kore-gray-light/40',
};

// ── Day detail panel ─────────────────────────────────────────
function DayDetailPanel({ day, onClose }: { day: ProgramDay; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = day.date === today;
  const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-4 border-b border-kore-gray-light/30">
        <div>
          <p className="text-[10px] text-kore-gray-dark/40 uppercase tracking-widest font-semibold mb-0.5">
            Día {day.day_number} de 28
          </p>
          <h2 className="font-heading text-lg font-semibold text-kore-gray-dark capitalize leading-tight">
            {dateLabel}
          </h2>
          <span className={`inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full mt-2 ${DAY_TYPE_COLOR[day.day_type]}`}>
            {DAY_TYPE_LABEL[day.day_type]}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-kore-cream transition-colors text-kore-gray-dark/40 hover:text-kore-gray-dark">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {day.exercises.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">{day.day_type === 'rest' ? '😴' : '🧘'}</p>
            <p className="text-sm text-kore-gray-dark/50">
              {day.day_type === 'rest' ? 'Día de descanso completo' : 'Actividad ligera de recuperación'}
            </p>
          </div>
        ) : (
          day.exercises.slice().sort((a, b) => a.order - b.order).map((pe, i) => {
            const repsLabel = pe.reps
              ? `${pe.sets} × ${pe.reps} reps`
              : pe.duration_seconds ? `${pe.sets} × ${pe.duration_seconds}s` : `${pe.sets} series`;
            return (
              <div key={pe.id} className="flex items-center gap-3 p-3 rounded-xl bg-kore-cream/40 hover:bg-kore-cream/70 transition-colors">
                <span className="w-6 h-6 rounded-full bg-kore-red/10 text-kore-red text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-kore-gray-dark truncate">{pe.exercise.name}</p>
                  <p className="text-xs text-kore-gray-dark/50 mt-0.5">
                    {repsLabel}{pe.rest_seconds ? ` · ${pe.rest_seconds}s descanso` : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CTA */}
      <div className="p-5 border-t border-kore-gray-light/30">
        {isToday ? (
          <Link href="/mi-programa/hoy?start=1" className="w-full flex items-center justify-center gap-2 bg-kore-red text-white font-bold py-3 rounded-xl hover:bg-kore-red/90 transition-colors text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Iniciar rutina
          </Link>
        ) : (
          <Link href={`/mi-programa/dia/${day.date}`} className="w-full flex items-center justify-center gap-2 border border-kore-gray-light text-kore-gray-dark/60 font-semibold py-3 rounded-xl hover:bg-kore-cream transition-colors text-sm">
            Ver detalle completo
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Placeholder when no day is selected on desktop ───────────
function DetailPlaceholder() {
  return (
    <div className="h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-kore-gray-light/60 p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-kore-gray-light/40 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-kore-gray-dark/40">Selecciona un día</p>
      <p className="text-xs text-kore-gray-dark/30 mt-1">para ver los ejercicios</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MiProgramaPage() {
  const router = useRouter();
  const { activeProgram, loading, fetchActiveProgram } = useProgramStore();
  const bubblesRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const detailContentRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<ProgramDay | null>(null);
  const [showAllLevels, setShowAllLevels] = useState(false);

  useEffect(() => { fetchActiveProgram(); }, [fetchActiveProgram]);

  // Floating bubbles
  useEffect(() => {
    if (!bubblesRef.current || !activeProgram) return;
    const ctx = gsap.context(() => {
      bubblesRef.current!.querySelectorAll('.prog-bubble').forEach((bubble) => {
        const size = 80 + Math.random() * 160;
        gsap.set(bubble, { left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, width: size, height: size, xPercent: -50, yPercent: -50, opacity: 0.15 + Math.random() * 0.25 });
        gsap.to(bubble, { x: `random(-80, 80)`, y: `random(-50, 50)`, scale: `random(0.7, 1.6)`, opacity: `random(0.2, 0.55)`, duration: `random(5, 10)`, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: Math.random() * 2 });
      });
    });
    return () => ctx.revert();
  }, [activeProgram]);

  // 3rd-column slide-in animation
  useEffect(() => {
    if (!detailPanelRef.current) return;
    if (selectedDay) {
      gsap.to(detailPanelRef.current, { width: 380, duration: 0.4, ease: 'power3.out' });
      if (detailContentRef.current) {
        gsap.fromTo(detailContentRef.current, { opacity: 0, x: 28 }, { opacity: 1, x: 0, duration: 0.35, delay: 0.1, ease: 'power3.out' });
      }
    } else {
      if (detailContentRef.current) {
        gsap.to(detailContentRef.current, { opacity: 0, x: 20, duration: 0.18, ease: 'power2.in' });
      }
      gsap.to(detailPanelRef.current, { width: 0, duration: 0.3, delay: 0.1, ease: 'power2.in' });
    }
  }, [selectedDay]);

  const handleDaySelect = (day: ProgramDay | null, dateStr: string) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      router.push(`/mi-programa/dia/${dateStr}`);
      return;
    }
    if (selectedDay?.date === dateStr) {
      setSelectedDay(null);
      return;
    }
    if (selectedDay && detailContentRef.current) {
      gsap.to(detailContentRef.current, { opacity: 0, x: 10, duration: 0.15, ease: 'power2.in', onComplete: () => setSelectedDay(day) });
    } else {
      setSelectedDay(day);
    }
  };

  const handleCloseDetail = () => setSelectedDay(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
      </div>
    );
  }

  if (!activeProgram) {
    return (
      <div className="min-h-screen bg-kore-cream flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-kore-red/10 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Sin programa activo</h2>
        <p className="text-sm text-kore-gray-dark/50 max-w-xs">Tu entrenador generará y publicará tu programa mensual personalizado pronto.</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayDay = activeProgram.days.find((d) => d.date === today);
  const daysPassed = activeProgram.days.filter((d) => d.date <= today).length;
  const progressPct = Math.round((daysPassed / activeProgram.days.length) * 100);
  const trainingCount = activeProgram.days.filter((d) => d.day_type === 'training').length;
  const activeRestCount = activeProgram.days.filter((d) => d.day_type === 'active_rest').length;
  const restCount = activeProgram.days.filter((d) => d.day_type === 'rest').length;
  const startLabel = new Date(activeProgram.start_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const endLabel = new Date(activeProgram.end_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

  const currentLevel = activeProgram.fitness_level ?? 1;
  const lvl = FITNESS_LEVELS[currentLevel - 1];
  const nextLvl = currentLevel < 5 ? FITNESS_LEVELS[currentLevel] : null;
  const trainingDaysTotal = activeProgram.days.filter((d) => d.day_type === 'training').length;
  const trainingDaysDone = activeProgram.days.filter((d) => d.day_type === 'training' && d.date <= today).length;
  const trainingPct = trainingDaysTotal > 0 ? Math.round((trainingDaysDone / trainingDaysTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-kore-cream">

      {/* ═══ HERO ═══ */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-kore-red via-kore-crimson to-kore-burgundy" />
        <div ref={bubblesRef} className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="prog-bubble absolute rounded-full" style={{
              background: ['radial-gradient(circle,rgba(255,64,64,.7) 0%,transparent 70%)', 'radial-gradient(circle,rgba(171,13,47,.6) 0%,transparent 70%)', 'radial-gradient(circle,rgba(255,118,118,.5) 0%,transparent 70%)', 'radial-gradient(circle,rgba(194,0,0,.5) 0%,transparent 70%)'][i % 4],
              filter: 'blur(6px)',
            }} />
          ))}
        </div>
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: GRAIN, backgroundSize: '128px 128px' }} />

        <div className="relative z-10 px-6 md:px-10 lg:px-14 pt-10 pb-6">
          <p className="text-[10px] text-white/90 uppercase tracking-widest font-semibold mb-3">Mi Programa</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            {/* Title + goal + level */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-heading text-3xl md:text-4xl font-bold text-white leading-tight">
                  {LEVEL_LABEL[activeProgram.fitness_level]}
                </h1>
                <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/25 text-white`}>
                  Nv. {currentLevel}
                </span>
              </div>
              <p className="text-white/70 text-sm">{GOAL_LABEL[activeProgram.goal] ?? activeProgram.goal}</p>
            </div>
            {/* Stats inline */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-center">
                <p className="font-heading text-3xl font-black text-white leading-none">{daysPassed}</p>
                <p className="text-[10px] text-white/50 mt-0.5">de 28 días</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="font-heading text-3xl font-black text-white leading-none">{trainingCount}</p>
                <p className="text-[10px] text-white/50 mt-0.5">entrenos</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="font-heading text-3xl font-black text-white leading-none">{trainingDaysDone}</p>
                <p className="text-[10px] text-white/50 mt-0.5">completados</p>
              </div>
            </div>
          </div>
          {/* Progress bar + dates */}
          <div className="mt-4 flex items-center gap-3 max-w-lg">
            <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[11px] text-white/40 shrink-0">{startLabel} → {endLabel}</p>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="px-6 md:px-10 lg:px-14 pb-10 mt-5 overflow-x-hidden">
        <div className="lg:flex lg:gap-6 lg:items-start">

          {/* ── LEFT: Calendar + trainer notes ── */}
          <div className="lg:w-[420px] lg:shrink-0 space-y-4">
            <ProgramCalendar
              program={activeProgram}
              selectedDateStr={selectedDay?.date}
              onSelectDay={handleDaySelect}
            />
            {activeProgram.trainer_notes && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-kore-red/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-kore-gray-dark uppercase tracking-wide">Nota del entrenador</p>
                </div>
                <p className="text-sm text-kore-gray-dark/70 leading-relaxed">{activeProgram.trainer_notes}</p>
              </div>
            )}
          </div>

          {/* ── MIDDLE: sidebar (fills remaining space) ── */}
          <div className="mt-4 lg:mt-0 lg:flex-1 lg:min-w-0 space-y-4">

            {/* Today CTA */}
            {todayDay && (
              <Link href="/mi-programa/hoy?start=1" className="group block bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-kore-red flex items-center justify-center shrink-0 shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-kore-gray-dark/40 uppercase tracking-widest font-semibold mb-0.5">Hoy · Día {todayDay.day_number}</p>
                    <p className="font-heading text-sm font-semibold text-kore-gray-dark">{DAY_TYPE_LABEL[todayDay.day_type]}</p>
                    {todayDay.exercises.length > 0 && (
                      <p className="text-xs text-kore-gray-dark/50 mt-0.5">{todayDay.exercises.length} ejercicios · ~{todayDay.exercises.length * 8} min</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-kore-red shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )}

            {/* ── Nivel de condición ── */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${lvl.bg} ${lvl.color}`}>
                      <span className="font-black">Nv.{currentLevel}</span> {lvl.name}
                    </span>
                    {nextLvl && (
                      <>
                        <svg className="w-3 h-3 text-kore-gray-dark/25" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                        <span className="text-xs text-kore-gray-dark/35 font-medium">{nextLvl.name}</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAllLevels((v) => !v)}
                    className="flex items-center gap-1 text-[10px] text-kore-gray-dark/40 hover:text-kore-gray-dark transition-colors"
                  >
                    {showAllLevels ? 'Ocultar' : 'Ver todos'}
                    <svg className={`w-3 h-3 transition-transform ${showAllLevels ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>
                {/* 5-segment bar */}
                <div className="flex gap-1 mb-1.5">
                  {FITNESS_LEVELS.map((l) => (
                    <div key={l.level} className={`flex-1 h-2 rounded-full transition-all ${l.level <= currentLevel ? lvl.fill : 'bg-gray-200'}`} />
                  ))}
                </div>
                <div className="flex">
                  {FITNESS_LEVELS.map((l) => (
                    <span key={l.level} className={`flex-1 text-center text-[9px] font-semibold ${l.level === currentLevel ? lvl.color : 'text-kore-gray-dark/20'}`}>
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Progress message */}
              <div className="px-4 pb-4 pt-3 border-t border-kore-gray-light/30">
                <p className="text-xs font-semibold text-kore-gray-dark mb-1">
                  {nextLvl ? `Sube a ${nextLvl.name} con constancia` : '¡Nivel máximo alcanzado!'}
                </p>
                <p className="text-[11px] text-kore-gray-dark/50 leading-relaxed mb-3">
                  {nextLvl
                    ? 'Cada rutina completada mejora tu condición. En tu próxima evaluación, tu entrenador medirá el avance y subirás de nivel.'
                    : 'Mantén la consistencia para sostener este rendimiento.'}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-kore-red rounded-full" style={{ width: `${trainingPct}%` }} />
                  </div>
                  <span className="text-[10px] text-kore-gray-dark/45 shrink-0 font-medium tabular-nums">
                    {trainingDaysDone}/{trainingDaysTotal}
                  </span>
                </div>
                <p className="text-[9px] text-kore-gray-dark/30 mt-1">entrenamientos del ciclo</p>
              </div>

              {/* Expanded levels */}
              {showAllLevels && (
                <div className="border-t border-kore-gray-light/30">
                  {FITNESS_LEVELS.map((l, i) => {
                    const isCurrent = l.level === currentLevel;
                    return (
                      <div
                        key={l.level}
                        className={`flex items-start gap-3 px-4 py-3 ${i < FITNESS_LEVELS.length - 1 ? 'border-b border-kore-gray-light/20' : ''} ${isCurrent ? l.bg : ''}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5 ${isCurrent ? 'bg-white/70' : 'bg-gray-100'} ${l.color}`}>
                          {l.level}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={`text-xs font-bold ${isCurrent ? l.color : 'text-kore-gray-dark'}`}>{l.name}</p>
                            <span className="text-[9px] text-kore-gray-dark/30">{l.training}</span>
                            {isCurrent && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/70 ${l.color}`}>Tú aquí</span>}
                          </div>
                          <p className="text-[11px] text-kore-gray-dark/55 leading-relaxed">{l.description}</p>
                          <p className="text-[10px] text-kore-gray-dark/35 mt-0.5">{l.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats mini-row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Entrenos', count: trainingCount, dot: 'bg-kore-red' },
                { label: 'Recuperación', count: activeRestCount, dot: 'bg-teal-500' },
                { label: 'Descanso', count: restCount, dot: 'bg-gray-300' },
              ].map(({ label, count, dot }) => (
                <div key={label} className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/60 shadow-sm text-center">
                  <div className={`w-1.5 h-1.5 rounded-full ${dot} mx-auto mb-1.5`} />
                  <p className="font-heading text-lg font-bold text-kore-gray-dark">{count}</p>
                  <p className="text-[9px] text-kore-gray-dark/45 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Quick nav: Progreso + Resumen */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/mi-programa/progreso" className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/60 shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-8 h-8 rounded-lg bg-kore-red/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm9.75-4.5C12.75 7.754 13.254 7.25 13.875 7.25h2.25c.621 0 1.125.504 1.125 1.125v12.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0112.75 20.625V8.625zm-4.875 6C7.875 13.254 8.379 12.75 9 12.75h2.25c.621 0 1.125.504 1.125 1.125v7.125c0 .621-.504 1.125-1.125 1.125H9A1.125 1.125 0 017.875 20v-5.375z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-kore-gray-dark">Mi Progreso</p>
                  <p className="text-[10px] text-kore-gray-dark/40">Semana a semana</p>
                </div>
                <svg className="w-3.5 h-3.5 text-kore-red/50 shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link href="/mi-programa/resumen" className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-white/60 shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-kore-gray-dark">Resumen</p>
                  <p className="text-[10px] text-kore-gray-dark/40">Cierre mensual</p>
                </div>
                <svg className="w-3.5 h-3.5 text-amber-400/70 shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>

          </div>

          {/* ── RIGHT: 3rd column — GSAP slide-in (desktop only) ── */}
          <div
            ref={detailPanelRef}
            className="hidden lg:block shrink-0 overflow-hidden"
            style={{ width: 0 }}
          >
            <div ref={detailContentRef} style={{ width: 380 }}>
              {selectedDay && (
                <DayDetailPanel day={selectedDay} onClose={handleCloseDetail} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
