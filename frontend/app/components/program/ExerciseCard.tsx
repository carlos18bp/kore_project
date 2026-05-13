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
            className="shrink-0 text-xs text-kore-gray-dark/40 hover:text-kore-gray-dark/70 transition-colors"
          >
            {videoOpen ? 'Ocultar video' : 'Ver video'}
          </button>
        )}
      </div>

      {/* YouTube embed — visible by default */}
      {exercise.youtube_url && videoOpen && (
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
