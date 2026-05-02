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
  const detailRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<ProgramDay | null>(null);

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

  // Detail panel animation
  useEffect(() => {
    if (!detailRef.current || !selectedDay) return;
    gsap.fromTo(detailRef.current, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' });
  }, [selectedDay]);

  const handleDaySelect = (day: ProgramDay | null, dateStr: string) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.push(`/mi-programa/dia/${dateStr}`);
      return;
    }
    if (selectedDay?.date === dateStr) {
      gsap.to(detailRef.current, { opacity: 0, x: 20, duration: 0.22, ease: 'power2.in', onComplete: () => setSelectedDay(null) });
      return;
    }
    if (selectedDay && detailRef.current) {
      gsap.to(detailRef.current, { opacity: 0, x: 10, duration: 0.15, ease: 'power2.in', onComplete: () => setSelectedDay(day) });
    } else {
      setSelectedDay(day);
    }
  };

  const handleCloseDetail = () => {
    gsap.to(detailRef.current, { opacity: 0, x: 20, duration: 0.22, ease: 'power2.in', onComplete: () => setSelectedDay(null) });
  };

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

  return (
    <div className="min-h-screen bg-kore-cream">

      {/* ═══ HERO ═══ */}
      <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
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

        <div className="relative z-10 px-6 pt-10 pb-8 max-w-3xl mx-auto">
          <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold mb-4">Mi Programa</p>
          <div className="flex items-end justify-between gap-6">
            {/* Left: title + goal */}
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-white leading-tight">
                {LEVEL_LABEL[activeProgram.fitness_level]}
              </h1>
              <p className="text-white/70 text-sm md:text-base mt-1">
                {GOAL_LABEL[activeProgram.goal] ?? activeProgram.goal}
              </p>
            </div>
            {/* Right: progress + dates */}
            <div className="text-right shrink-0">
              <p className="font-heading text-5xl font-black text-white leading-none">{daysPassed}</p>
              <p className="text-xs text-white/50 mt-1">de 28 días</p>
              <p className="text-[11px] text-white/40 mt-2">{startLabel} → {endLabel}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-5 h-1.5 bg-white/15 rounded-full overflow-hidden max-w-sm">
            <div className="h-full bg-white rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="px-6 pb-10 mt-5 max-w-3xl mx-auto">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5 max-w-xs">
          {[
            { label: 'Entrenamientos', count: trainingCount, dot: 'bg-kore-red' },
            { label: 'Recuperación', count: activeRestCount, dot: 'bg-teal-500' },
            { label: 'Descanso', count: restCount, dot: 'bg-kore-gray-light border border-kore-gray-dark/20' },
          ].map(({ label, count, dot }) => (
            <div key={label} className="bg-white/70 backdrop-blur-sm rounded-2xl p-3 border border-white/60 shadow-sm text-center">
              <div className={`w-2 h-2 rounded-full ${dot} mx-auto mb-1.5`} />
              <p className="font-heading text-xl font-bold text-kore-gray-dark">{count}</p>
              <p className="text-[10px] text-kore-gray-dark/50 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Main 2-column grid on desktop */}
        <div className="md:grid md:grid-cols-[1fr_300px] md:gap-5">

          {/* LEFT: Calendar */}
          <div className="space-y-4">
            <ProgramCalendar
              program={activeProgram}
              selectedDateStr={selectedDay?.date}
              onSelectDay={handleDaySelect}
            />

            {/* Trainer notes (below calendar on desktop) */}
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

          {/* RIGHT: Today CTA + Day detail panel */}
          <div className="mt-4 md:mt-0 space-y-4 flex flex-col">

            {/* Today CTA */}
            {todayDay && (
              <Link href="/mi-programa/hoy?start=1" className="group block bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-kore-red flex items-center justify-center shrink-0 shadow-sm">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-kore-gray-dark/40 uppercase tracking-widest font-semibold mb-0.5">Hoy · Día {todayDay.day_number}</p>
                    <p className="font-heading text-base font-semibold text-kore-gray-dark">{DAY_TYPE_LABEL[todayDay.day_type]}</p>
                    {todayDay.exercises.length > 0 && (
                      <p className="text-xs text-kore-gray-dark/50 mt-0.5">{todayDay.exercises.length} ejercicios · ~{todayDay.exercises.length * 8} min</p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-kore-red shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )}

            {/* Detail panel (desktop only) */}
            <div className="hidden md:block flex-1">
              {selectedDay ? (
                <div ref={detailRef}>
                  <DayDetailPanel day={selectedDay} onClose={handleCloseDetail} />
                </div>
              ) : (
                <DetailPlaceholder />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
