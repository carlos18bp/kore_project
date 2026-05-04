'use client';

import { useState, useCallback } from 'react';
import type { TodayData, ExerciseLog } from '@/lib/stores/programStore';
import YouTubeEmbed from './YouTubeEmbed';
import RestTimer from './RestTimer';

type Props = {
  todayData: TodayData;
  onClose: () => void;
  onStatusChange: (exLogId: number, status: 'completed' | 'skipped' | 'not_done') => void;
};

const DAY_TYPE_LABEL: Record<string, string> = {
  training: 'Entrenamiento',
  active_rest: 'Recuperación activa',
  rest: 'Descanso',
};

export default function WorkoutSession({ todayData, onClose, onStatusChange }: Props) {
  const { program_day, daily_log } = todayData;

  const exerciseLogs = [...daily_log.exercise_logs].sort(
    (a, b) => a.program_exercise.order - b.program_exercise.order,
  );
  const total = exerciseLogs.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [setsDone, setSetsDone] = useState<Record<number, number>>({});
  const [showTimer, setShowTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timerRemaining, setTimerRemaining] = useState(60);
  const [phase, setPhase] = useState<'workout' | 'complete'>('workout');

  const currentLog = exerciseLogs[currentIndex];
  const completedCount = exerciseLogs.filter((el) => el.status === 'completed').length;
  const skippedCount = exerciseLogs.filter((el) => el.status === 'skipped').length;

  const goToNext = useCallback(() => {
    setShowTimer(false);
    if (currentIndex >= total - 1) {
      setPhase('complete');
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, total]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setShowTimer(false);
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleSetTap = (setIndex: number) => {
    if (!currentLog || daily_log.is_closed) return;
    const newCount = setIndex + 1;
    setSetsDone((prev) => ({ ...prev, [currentLog.id]: newCount }));
    const restSecs = currentLog.program_exercise.rest_seconds || 60;
    setTimerSeconds(restSecs);
    setTimerRemaining(restSecs);
    setShowTimer(true);
  };

  const handleComplete = () => {
    if (!currentLog) return;
    onStatusChange(currentLog.id, 'completed');
    goToNext();
  };

  const handleSkip = () => {
    if (!currentLog) return;
    onStatusChange(currentLog.id, 'skipped');
    goToNext();
  };

  if (phase === 'complete') {
    return (
      <div className="fixed inset-0 z-[60] bg-kore-cream flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-kore-gray-dark mb-2">¡Sesión completada!</h2>
        <p className="text-sm text-kore-gray-dark/60 mb-8">Has terminado tu rutina del día</p>
        <div className="flex gap-4 mb-8">
          <div className="bg-emerald-50 rounded-2xl px-5 py-3 text-center border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
            <p className="text-xs text-emerald-700 mt-0.5">Completados</p>
          </div>
          {skippedCount > 0 && (
            <div className="bg-yellow-50 rounded-2xl px-5 py-3 text-center border border-yellow-100">
              <p className="text-2xl font-bold text-yellow-600">{skippedCount}</p>
              <p className="text-xs text-yellow-700 mt-0.5">Omitidos</p>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="bg-kore-red text-white font-semibold px-8 py-3 rounded-2xl hover:bg-kore-red/90 transition-colors"
        >
          Ver resumen
        </button>
      </div>
    );
  }

  if (!currentLog) return null;

  const { exercise, sets, reps, duration_seconds, rest_seconds } = currentLog.program_exercise;
  const repsLabel = reps ? `${sets} × ${reps} reps` : `${sets} × ${duration_seconds}s`;
  const currentSetsDone = setsDone[currentLog.id] ?? 0;
  const allSetsDone = currentSetsDone >= sets && sets > 0;

  return (
    <div className="fixed inset-0 z-[60] bg-kore-cream flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-kore-gray-light/30 bg-white/80 backdrop-blur-sm shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 text-kore-gray-dark/50 hover:text-kore-gray-dark transition-colors"
          aria-label="Cerrar sesión"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="text-xs font-semibold text-kore-gray-dark">
          Día {program_day.day_number} · {DAY_TYPE_LABEL[program_day.day_type]}
        </p>
        <span className="text-xs font-bold text-kore-red">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-kore-gray-light/40 shrink-0">
        <div
          className="h-full bg-kore-red transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto pb-28">

          {/* Video */}
          {exercise.youtube_url ? (
            <YouTubeEmbed url={exercise.youtube_url} title={exercise.name} />
          ) : (
            <div
              className="w-full rounded-xl bg-kore-gray-light/30 flex items-center justify-center"
              style={{ aspectRatio: '16/9' }}
            >
              <p className="text-kore-gray-dark/30 text-sm">Sin video disponible</p>
            </div>
          )}

          {/* Exercise info */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {exercise.pattern && (
                <span className="text-xs font-medium bg-kore-gray-light/40 text-kore-gray-dark/60 px-2 py-0.5 rounded-full">
                  {exercise.pattern}
                </span>
              )}
              {exercise.is_corrective && (
                <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                  Correctivo
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-kore-gray-dark leading-tight">{exercise.name}</h2>
            <p className="text-sm text-kore-gray-dark/60 mt-0.5">
              {repsLabel} · {rest_seconds}s descanso
            </p>
          </div>

          {/* Set tracker */}
          {!daily_log.is_closed && sets > 0 && (
            <div className="bg-white/70 rounded-2xl p-4 border border-kore-gray-light/30">
              <p className="text-xs font-semibold text-kore-gray-dark/50 uppercase tracking-wider mb-3">
                Series — {currentSetsDone} / {sets}
              </p>
              <div className="flex gap-2.5 flex-wrap">
                {Array.from({ length: sets }).map((_, i) => {
                  const done = i < currentSetsDone;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSetTap(i)}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                        done
                          ? 'bg-kore-red text-white shadow-sm scale-95'
                          : 'bg-kore-gray-light/40 text-kore-gray-dark/40 hover:bg-kore-gray-light/60'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rest Timer */}
          {showTimer && (
            <div className="bg-white/70 rounded-2xl border border-kore-gray-light/30">
              <RestTimer
                seconds={timerSeconds}
                remaining={timerRemaining}
                setRemaining={setTimerRemaining}
                onComplete={() => setShowTimer(false)}
                onDismiss={() => setShowTimer(false)}
              />
            </div>
          )}

          {/* Exercise description */}
          {exercise.explanation && (
            <p className="text-xs text-kore-gray-dark/65 leading-relaxed px-1">
              {exercise.explanation}
            </p>
          )}
        </div>
      </div>

      {/* Fixed bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-[61] bg-white/95 backdrop-blur-sm border-t border-kore-gray-light/30 px-4 py-3">
        <div className="flex gap-2 max-w-lg mx-auto">
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="w-10 h-10 rounded-xl border border-kore-gray-light/50 flex items-center justify-center text-kore-gray-dark/50 hover:text-kore-gray-dark disabled:opacity-30 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {!daily_log.is_closed ? (
            <>
              <button
                onClick={handleComplete}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  allSetsDone
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                ✓ Completar
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-kore-gray-light/30 text-kore-gray-dark/60 hover:bg-kore-gray-light/50 transition-colors"
              >
                Omitir
              </button>
            </>
          ) : (
            <button
              onClick={goToNext}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-kore-gray-light/30 text-kore-gray-dark transition-colors"
            >
              {currentIndex < total - 1 ? 'Siguiente' : 'Finalizar'}
            </button>
          )}

          <button
            onClick={goToNext}
            className="w-10 h-10 rounded-xl border border-kore-gray-light/50 flex items-center justify-center text-kore-gray-dark/50 hover:text-kore-gray-dark transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
