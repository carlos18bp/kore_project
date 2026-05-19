'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useProgramStore } from '@/lib/stores/programStore';
import type { ProgramDay } from '@/lib/stores/programStore';
import ProgramCalendar from '@/app/components/program/ProgramCalendar';
import ProgressTabsCard from '@/app/components/program/ProgressTabsCard';

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
const HERO_STYLES = `
  @keyframes prog-orb-1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.15)}}
  @keyframes prog-orb-2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,40px) scale(0.9)}}
  @keyframes prog-orb-3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,30px) scale(1.1)}}
  @keyframes prog-aurora{0%,100%{opacity:0.45}50%{opacity:0.85}}
`;
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
      <div className="flex items-start justify-between p-5 pb-4 border-b border-kore-gray-light/30">
        <div>
          <p className="text-[10.5px] text-kore-gray-dark/40 uppercase tracking-[0.14em] font-semibold mb-1">Día {day.day_number} de 28</p>
          <h2 className="font-heading text-[20px] font-semibold text-kore-wine-dark capitalize leading-tight">{dateLabel}</h2>
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
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {day.exercises.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">{day.day_type === 'rest' ? '😴' : '🧘'}</p>
            <p className="text-sm text-kore-gray-dark/50">{day.day_type === 'rest' ? 'Día de descanso completo' : 'Actividad ligera de recuperación'}</p>
          </div>
        ) : (
          day.exercises.slice().sort((a, b) => a.order - b.order).map((pe, i) => {
            const repsLabel = pe.reps ? `${pe.sets} × ${pe.reps} reps` : pe.duration_seconds ? `${pe.sets} × ${pe.duration_seconds}s` : `${pe.sets} series`;
            return (
              <div key={pe.id} className="flex items-center gap-3 p-3 rounded-xl bg-kore-cream/40 hover:bg-kore-cream/70 transition-colors">
                <span className="w-6 h-6 rounded-full bg-kore-red/10 text-kore-red text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-kore-gray-dark truncate">{pe.exercise.name}</p>
                  <p className="text-xs text-kore-gray-dark/50 mt-0.5">{repsLabel}{pe.rest_seconds ? ` · ${pe.rest_seconds}s descanso` : ''}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="p-5 border-t border-kore-gray-light/30">
        {isToday ? (
          <Link href="/mi-programa/rutina" className="w-full flex items-center justify-center gap-2 bg-kore-red text-white font-bold py-3 rounded-xl hover:bg-kore-red/90 transition-colors text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            Iniciar rutina
          </Link>
        ) : (
          <p className="text-xs text-kore-gray-dark/40 text-center">{day.exercises.length} ejercicio{day.exercises.length !== 1 ? 's' : ''} programados</p>
        )}
      </div>
    </div>
  );
}

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

export default function MiProgramaPage() {
  const router = useRouter();
  const { activeProgram, loading, fetchActiveProgram } = useProgramStore();
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const detailContentRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<ProgramDay | null>(null);
  const [showAllLevels, setShowAllLevels] = useState(false);

  useEffect(() => { fetchActiveProgram(); }, [fetchActiveProgram]);

  // 3rd-column slide-in
  useEffect(() => {
    if (!detailPanelRef.current) return;
    if (selectedDay) {
      gsap.to(detailPanelRef.current, { width: 380, duration: 0.4, ease: 'power3.out' });
      if (detailContentRef.current) gsap.fromTo(detailContentRef.current, { opacity: 0, x: 28 }, { opacity: 1, x: 0, duration: 0.35, delay: 0.1, ease: 'power3.out' });
    } else {
      if (detailContentRef.current) gsap.to(detailContentRef.current, { opacity: 0, x: 20, duration: 0.18, ease: 'power2.in' });
      gsap.to(detailPanelRef.current, { width: 0, duration: 0.3, delay: 0.1, ease: 'power2.in' });
    }
  }, [selectedDay]);

  const handleDaySelect = (day: ProgramDay | null, dateStr: string) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      if (dateStr === new Date().toISOString().slice(0, 10) && day?.day_type === 'training') {
        router.push('/mi-programa/rutina');
      } else {
        router.push(`/mi-programa/dia/detail?date=${dateStr}`);
      }
      return;
    }
    if (selectedDay?.date === dateStr) { setSelectedDay(null); return; }
    if (selectedDay && detailContentRef.current) {
      gsap.to(detailContentRef.current, { opacity: 0, x: 10, duration: 0.15, ease: 'power2.in', onComplete: () => setSelectedDay(day) });
    } else {
      setSelectedDay(day);
    }
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
  const currentLevel = activeProgram.fitness_level ?? 1;
  const lvl = FITNESS_LEVELS[currentLevel - 1];
  const nextLvl = currentLevel < 5 ? FITNESS_LEVELS[currentLevel] : null;
  const trainingDaysTotal = activeProgram.days.filter((d) => d.day_type === 'training').length;
  const trainingDaysDone = activeProgram.days.filter((d) => d.day_type === 'training' && d.date <= today).length;
  const trainingPct = trainingDaysTotal > 0 ? Math.round((trainingDaysDone / trainingDaysTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-kore-cream">

      {/* ═══ CONTENT ═══ */}
      <div className="px-6 md:px-10 lg:px-14 pb-10 pt-5 overflow-x-hidden">

        {/* ── Hero dark card ── */}
        <div className="relative overflow-hidden rounded-[22px] shadow-xl mb-5" style={{ background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)' }}>
          <style>{HERO_STYLES}</style>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,233,220,0.20) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(20,5,12,0.65) 0%, transparent 55%)', animation: 'prog-aurora 8s ease-in-out infinite' }} />
          <div className="absolute pointer-events-none" style={{ top: '20%', right: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)', filter: 'blur(30px)', animation: 'prog-orb-1 9s ease-in-out infinite' }} />
          <div className="absolute pointer-events-none" style={{ bottom: '10%', left: '20%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'prog-orb-2 11s ease-in-out infinite' }} />
          <div className="relative z-10 p-6 md:p-7 xl:p-9">
            <p className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-2.5" style={{ color: '#E7C8A0' }}>Mi Programa</p>
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 xl:gap-7">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-heading text-[28px] xl:text-[38px] font-semibold leading-[1.05]" style={{ color: '#FFF8EC', letterSpacing: '-0.015em' }}>{LEVEL_LABEL[activeProgram.fitness_level]}</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(231,200,160,0.15)', color: '#E7C8A0' }}>Nv. {currentLevel}</span>
                </div>
                <p className="text-[14px] mt-2" style={{ color: '#FFE9DC', opacity: 0.8 }}>{GOAL_LABEL[activeProgram.goal] ?? activeProgram.goal}</p>
              </div>
              <div className="flex items-center gap-5 xl:gap-7 shrink-0">
                <div className="text-center">
                  <p className="font-heading text-[28px] xl:text-[36px] font-semibold leading-none" style={{ color: '#FFF8EC' }}>{daysPassed}</p>
                  <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold mt-1.5" style={{ color: '#E7C8A0', opacity: 0.85 }}>de 28 días</p>
                </div>
                <div className="w-px h-10" style={{ background: 'rgba(231,200,160,0.2)' }} />
                <div className="text-center">
                  <p className="font-heading text-[28px] xl:text-[36px] font-semibold leading-none" style={{ color: '#FFF8EC' }}>{trainingDaysDone}<span className="text-[18px] xl:text-[22px] font-normal" style={{ color: 'rgba(255,233,220,0.45)' }}>/{trainingCount}</span></p>
                  <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold mt-1.5" style={{ color: '#E7C8A0', opacity: 0.85 }}>entrenos</p>
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, #E00000, #9A0526)', transition: 'width 700ms ease-out' }} />
              </div>
              <p className="text-[12px] text-white/55 shrink-0 tabular-nums font-semibold">{progressPct}%</p>
              <p className="text-[11px] text-white/40 shrink-0">{startLabel} → {endLabel}</p>
            </div>
          </div>
        </div>
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
                  <p className="text-[10.5px] font-semibold text-kore-gray-dark/50 uppercase tracking-[0.14em]">Nota del entrenador</p>
                </div>
                <p className="text-sm text-kore-gray-dark/70 leading-relaxed">{activeProgram.trainer_notes}</p>
              </div>
            )}

          </div>

          {/* ── MIDDLE ── */}
          <div className="mt-4 lg:mt-0 lg:flex-1 lg:min-w-0 space-y-4">

            {/* Today CTA */}
            {todayDay && (
              <Link href="/mi-programa/rutina" className="group block bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-kore-red flex items-center justify-center shrink-0 shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10.5px] text-kore-gray-dark/40 uppercase tracking-[0.14em] font-semibold mb-1">Hoy · Día {todayDay.day_number}</p>
                    <p className="font-heading text-[18px] font-semibold text-kore-wine-dark leading-tight">{DAY_TYPE_LABEL[todayDay.day_type]}</p>
                    {todayDay.exercises.length > 0 && (
                      <p className="text-[13px] text-kore-gray-dark/55 mt-0.5">{todayDay.exercises.length} ejercicios · ~{todayDay.exercises.length * 8} min</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-kore-red shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            )}

            {/* Fitness level */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
              <div className="p-4">
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
                  <button onClick={() => setShowAllLevels((v) => !v)} className="flex items-center gap-1 text-[10px] text-kore-gray-dark/40 hover:text-kore-gray-dark transition-colors">
                    {showAllLevels ? 'Ocultar' : 'Ver todos'}
                    <svg className={`w-3 h-3 transition-transform ${showAllLevels ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-1 mb-1.5">
                  {FITNESS_LEVELS.map((l) => (
                    <div key={l.level} className={`flex-1 h-2 rounded-full transition-all ${l.level <= currentLevel ? lvl.fill : 'bg-gray-200'}`} />
                  ))}
                </div>
                <div className="flex">
                  {FITNESS_LEVELS.map((l) => (
                    <span key={l.level} className={`flex-1 text-center text-[9px] font-semibold ${l.level === currentLevel ? lvl.color : 'text-kore-gray-dark/20'}`}>{l.name}</span>
                  ))}
                </div>
              </div>
              <div className="px-4 pb-4 pt-3 border-t border-kore-gray-light/30">
                <p className="text-xs font-semibold text-kore-gray-dark mb-1">
                  {nextLvl ? `Sube a ${nextLvl.name} con constancia` : '¡Nivel máximo alcanzado!'}
                </p>
                <p className="text-[11px] text-kore-gray-dark/50 leading-relaxed mb-3">
                  {nextLvl ? 'Cada rutina completada mejora tu condición. En tu próxima evaluación, tu entrenador medirá el avance y subirás de nivel.' : 'Mantén la consistencia para sostener este rendimiento.'}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-kore-red rounded-full" style={{ width: `${trainingPct}%` }} />
                  </div>
                  <span className="text-[10px] text-kore-gray-dark/45 shrink-0 font-medium tabular-nums">{trainingDaysDone}/{trainingDaysTotal}</span>
                </div>
                <p className="text-[9px] text-kore-gray-dark/30 mt-1">entrenamientos del ciclo</p>
              </div>
              {showAllLevels && (
                <div className="border-t border-kore-gray-light/30">
                  {FITNESS_LEVELS.map((l, i) => {
                    const isCurrent = l.level === currentLevel;
                    return (
                      <div key={l.level} className={`flex items-start gap-3 px-4 py-3 ${i < FITNESS_LEVELS.length - 1 ? 'border-b border-kore-gray-light/20' : ''} ${isCurrent ? l.bg : ''}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5 ${isCurrent ? 'bg-white/70' : 'bg-gray-100'} ${l.color}`}>{l.level}</div>
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
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Entrenos', count: trainingCount, dot: 'bg-kore-red' },
                { label: 'Recuperación', count: activeRestCount, dot: 'bg-teal-500' },
                { label: 'Descanso', count: restCount, dot: 'bg-gray-300' },
              ].map(({ label, count, dot }) => (
                <div key={label} className="bg-white/70 backdrop-blur-sm rounded-2xl p-3.5 border border-white/60 shadow-sm text-center">
                  <div className={`w-1.5 h-1.5 rounded-full ${dot} mx-auto mb-1.5`} />
                  <p className="font-heading text-[20px] font-bold text-kore-wine-dark leading-none">{count}</p>
                  <p className="text-[10px] text-kore-gray-dark/45 uppercase tracking-[0.12em] font-semibold mt-1">{label}</p>
                </div>
              ))}
            </div>

          </div>

          {/* ── RIGHT: 3rd column — GSAP slide-in (desktop only) ── */}
          <div ref={detailPanelRef} className="hidden lg:block shrink-0 overflow-hidden" style={{ width: 0 }}>
            <div ref={detailContentRef} style={{ width: 380 }}>
              {selectedDay ? (
                <DayDetailPanel day={selectedDay} onClose={() => setSelectedDay(null)} />
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
