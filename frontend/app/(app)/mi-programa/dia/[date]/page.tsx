'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useProgramStore } from '@/lib/stores/programStore';
import DayRoutineView from '@/app/components/program/DayRoutineView';
import WorkoutPresentation from '@/app/components/program/WorkoutPresentation';

function DiaProgramaContent() {
  const { todayData, todayLoading, fetchTodayData, updateExerciseStatus } = useProgramStore();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const hasAutoStarted = useRef(false);
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('start') === '1';

  useEffect(() => {
    fetchTodayData();
  }, [fetchTodayData]);

  // Auto-launch presentation when coming from dashboard card — fires only once
  useEffect(() => {
    if (!todayLoading && todayData && autoStart && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      setIsSessionActive(true);
    }
  }, [todayLoading, todayData, autoStart]);

  if (todayLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
      </div>
    );
  }

  if (!todayData) {
    return (
      <main className="px-4 py-8 max-w-xl mx-auto text-center">
        <div className="rounded-2xl border border-kore-gray-light/50 p-8">
          <p className="text-3xl mb-3">📅</p>
          <p className="font-semibold text-kore-gray-dark">Sin programa para este día</p>
          <p className="text-sm text-kore-gray-dark/50 mt-1">
            No hay programa activo o esta fecha está fuera del rango.
          </p>
          <Link href="/mi-programa" className="inline-block mt-4 text-sm text-kore-red hover:underline">
            ← Ver mapa del mes
          </Link>
        </div>
      </main>
    );
  }

  const dateLabel = new Date(todayData.program_day.date + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const { program_day, daily_log } = todayData;
  const canStart = !daily_log.is_closed && program_day.exercises.length > 0;

  const handleStatusChange = (exLogId: number, status: 'completed' | 'skipped' | 'not_done') => {
    updateExerciseStatus(daily_log.id, exLogId, status);
  };

  const handleSessionClose = () => {
    setIsSessionActive(false);
    fetchTodayData();
  };

  return (
    <>
      {isSessionActive && (
        <WorkoutPresentation
          todayData={todayData}
          onClose={handleSessionClose}
          onStatusChange={handleStatusChange}
        />
      )}

      <main className="px-4 py-6 max-w-xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/mi-programa" className="text-kore-gray-dark/50 hover:text-kore-gray-dark">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-kore-gray-dark capitalize">{dateLabel}</h1>
              <p className="text-xs text-kore-gray-dark/40">Día {program_day.day_number} de 28</p>
            </div>
          </div>

          {canStart && (
            <button
              onClick={() => setIsSessionActive(true)}
              className="flex items-center gap-2 bg-kore-red text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-kore-red/90 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Iniciar
            </button>
          )}
        </div>

        <DayRoutineView
          todayData={todayData}
          onStatusChange={(exLogId, status) => updateExerciseStatus(daily_log.id, exLogId, status)}
        />
      </main>
    </>
  );
}

export default function DiaProgramaPage() {
  return (
    <Suspense>
      <DiaProgramaContent />
    </Suspense>
  );
}
