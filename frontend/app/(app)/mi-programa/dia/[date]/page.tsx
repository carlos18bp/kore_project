'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { useProgramStore } from '@/lib/stores/programStore';
import DayRoutineView from '@/app/components/program/DayRoutineView';
import WorkoutPresentation from '@/app/components/program/WorkoutPresentation';

const DAY_TYPE_LABEL: Record<string, string> = {
  training: 'Día de entrenamiento',
  active_rest: 'Recuperación activa',
  rest: 'Día de descanso',
};

function DiaProgramaContent() {
  const params = useParams();
  const dateParam = params.date as string;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = dateParam === todayStr;

  const { activeProgram, todayData, todayLoading, fetchActiveProgram, fetchTodayData, updateExerciseStatus } = useProgramStore();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const hasAutoStarted = useRef(false);
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('start') === '1';

  useEffect(() => {
    if (isToday) {
      fetchTodayData();
    } else {
      fetchActiveProgram();
    }
  }, [isToday, fetchTodayData, fetchActiveProgram]);

  // Auto-launch presentation only for today
  useEffect(() => {
    if (isToday && !todayLoading && todayData && autoStart && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      setIsSessionActive(true);
    }
  }, [isToday, todayLoading, todayData, autoStart]);

  // Loading state
  if (isToday && todayLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
      </div>
    );
  }

  // Today: use todayData (has exercise logs)
  if (isToday) {
    if (!todayData) {
      return <NoDayFound />;
    }

    const { program_day, daily_log } = todayData;
    const dateLabel = new Date(program_day.date + 'T12:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const canStart = !daily_log.is_closed && program_day.exercises.length > 0;

    return (
      <>
        {isSessionActive && (
          <WorkoutPresentation
            todayData={todayData}
            onClose={() => { setIsSessionActive(false); fetchTodayData(); }}
            onStatusChange={(exLogId, status) => updateExerciseStatus(daily_log.id, exLogId, status)}
          />
        )}
        <main className="px-4 py-6 max-w-xl mx-auto space-y-5">
          <PageHeader dateLabel={dateLabel} dayNumber={program_day.day_number}>
            {canStart && (
              <button
                onClick={() => setIsSessionActive(true)}
                className="flex items-center gap-2 bg-kore-red text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-kore-red/90 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Iniciar
              </button>
            )}
          </PageHeader>
          <DayRoutineView
            todayData={todayData}
            onStatusChange={(exLogId, status) => updateExerciseStatus(daily_log.id, exLogId, status)}
          />
        </main>
      </>
    );
  }

  // Non-today: use activeProgram days (read-only)
  const programDay = activeProgram?.days.find((d) => d.date === dateParam);
  if (!programDay) {
    return <NoDayFound />;
  }

  const dateLabel = new Date(programDay.date + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <main className="px-4 py-6 max-w-xl mx-auto space-y-5">
      <PageHeader dateLabel={dateLabel} dayNumber={programDay.day_number} />

      {/* Day type badge */}
      <div>
        <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${
          programDay.day_type === 'training' ? 'bg-kore-red/10 text-kore-red' :
          programDay.day_type === 'active_rest' ? 'bg-teal-50 text-teal-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {DAY_TYPE_LABEL[programDay.day_type]}
        </span>
      </div>

      {programDay.exercises.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-4xl mb-3">{programDay.day_type === 'rest' ? '😴' : '🧘'}</p>
          <p className="text-sm text-kore-gray-dark/50">
            {programDay.day_type === 'rest' ? 'Día de descanso completo' : 'Actividad ligera de recuperación'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {programDay.exercises.slice().sort((a, b) => a.order - b.order).map((pe, i) => {
            const repsLabel = pe.reps
              ? `${pe.sets} × ${pe.reps} reps`
              : pe.duration_seconds ? `${pe.sets} × ${pe.duration_seconds}s` : `${pe.sets} series`;
            return (
              <div key={pe.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/70 border border-white/60 shadow-sm">
                <span className="w-6 h-6 rounded-full bg-kore-red/10 text-kore-red text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-kore-gray-dark truncate">{pe.exercise.name}</p>
                  <p className="text-xs text-kore-gray-dark/50 mt-0.5">
                    {repsLabel}{pe.rest_seconds ? ` · ${pe.rest_seconds}s descanso` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function PageHeader({ dateLabel, dayNumber, children }: { dateLabel: string; dayNumber: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href="/mi-programa" className="text-kore-gray-dark/50 hover:text-kore-gray-dark">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-kore-gray-dark capitalize">{dateLabel}</h1>
          <p className="text-xs text-kore-gray-dark/40">Día {dayNumber} de 28</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function NoDayFound() {
  return (
    <main className="px-4 py-8 max-w-xl mx-auto text-center">
      <div className="rounded-2xl border border-kore-gray-light/50 p-8">
        <p className="text-3xl mb-3">📅</p>
        <p className="font-semibold text-kore-gray-dark">Sin programa para este día</p>
        <p className="text-sm text-kore-gray-dark/50 mt-1">Esta fecha está fuera del rango del programa activo.</p>
        <Link href="/mi-programa" className="inline-block mt-4 text-sm text-kore-red hover:underline">← Ver mapa del mes</Link>
      </div>
    </main>
  );
}

export default function DiaProgramaPage() {
  return (
    <Suspense>
      <DiaProgramaContent />
    </Suspense>
  );
}
