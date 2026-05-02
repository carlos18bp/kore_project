'use client';

import { useState } from 'react';
import type { ProgramExercise, ExerciseLog } from '@/lib/stores/programStore';
import YouTubeEmbed from './YouTubeEmbed';

type Props = {
  programExercise: ProgramExercise;
  exerciseLog?: ExerciseLog;
  logClosed?: boolean;
  onStatusChange?: (exLogId: number, status: ExerciseLog['status']) => void;
};

const STATUS_STYLES: Record<ExerciseLog['status'], string> = {
  completed: 'border-emerald-400 bg-emerald-50',
  skipped: 'border-yellow-300 bg-yellow-50',
  not_done: 'border-kore-gray-light/40',
};

export default function ExerciseCard({ programExercise, exerciseLog, logClosed, onStatusChange }: Props) {
  const [videoOpen, setVideoOpen] = useState(false);
  const { exercise, sets, reps, duration_seconds, rest_seconds } = programExercise;

  const repsLabel = reps ? `${sets} × ${reps} reps` : `${sets} × ${duration_seconds}s`;
  const currentStatus = exerciseLog?.status ?? 'not_done';
  const borderClass = STATUS_STYLES[currentStatus];

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all duration-150 ${borderClass}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-kore-gray-dark/50 bg-kore-gray-light/30 px-2 py-0.5 rounded-full">
              {exercise.pattern}
            </span>
            {exercise.is_corrective && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Correctivo
              </span>
            )}
          </div>
          <p className="mt-1 font-semibold text-kore-gray-dark text-sm leading-tight">{exercise.name}</p>
          <p className="text-xs text-kore-gray-dark/60 mt-0.5">
            {repsLabel} · {rest_seconds}s descanso
          </p>
        </div>

        {exercise.youtube_url && (
          <button
            onClick={() => setVideoOpen((v) => !v)}
            className="shrink-0 text-xs text-kore-red hover:text-kore-red/80 flex items-center gap-1 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            {videoOpen ? 'Ocultar' : 'Video'}
          </button>
        )}
      </div>

      {/* Explanation — always visible */}
      {exercise.explanation && (
        <p className="mt-3 text-xs text-kore-gray-dark/65 leading-relaxed border-t border-kore-gray-light/30 pt-3">
          {exercise.explanation}
        </p>
      )}

      {/* YouTube embed */}
      {videoOpen && exercise.youtube_url && (
        <div className="mt-3">
          <YouTubeEmbed url={exercise.youtube_url} title={exercise.name} />
        </div>
      )}

      {/* Status buttons */}
      {exerciseLog && onStatusChange && !logClosed && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onStatusChange(exerciseLog.id, 'completed')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentStatus === 'completed'
                ? 'bg-emerald-500 text-white'
                : 'bg-kore-gray-light/30 text-kore-gray-dark hover:bg-emerald-100 hover:text-emerald-700'
            }`}
          >
            ✓ Completado
          </button>
          <button
            onClick={() => onStatusChange(exerciseLog.id, 'skipped')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentStatus === 'skipped'
                ? 'bg-yellow-400 text-white'
                : 'bg-kore-gray-light/30 text-kore-gray-dark hover:bg-yellow-100 hover:text-yellow-700'
            }`}
          >
            Omitir
          </button>
        </div>
      )}

      {logClosed && (
        <p className="mt-2 text-xs text-kore-gray-dark/40 italic">Registro cerrado</p>
      )}
    </div>
  );
}
