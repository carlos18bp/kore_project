'use client';

import type { TodayData, ExerciseLog } from '@/lib/stores/programStore';
import ExerciseCard from './ExerciseCard';

type Props = {
  todayData: TodayData;
  onStatusChange: (exLogId: number, status: ExerciseLog['status']) => void;
};

const DAY_TYPE_LABEL: Record<string, string> = {
  training: 'Día de entrenamiento',
  active_rest: 'Recuperación activa',
  rest: 'Día de descanso',
};

export default function DayRoutineView({ todayData, onStatusChange }: Props) {
  const { program_day, daily_log } = todayData;
  const logs = daily_log.exercise_logs;
  const logMap = Object.fromEntries(logs.map((l) => [l.program_exercise.id, l]));

  const completed = logs.filter((l) => l.status === 'completed').length;
  const total = logs.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-kore-gray-dark">{DAY_TYPE_LABEL[program_day.day_type]}</p>
          {total > 0 && (
            <p className="text-xs text-kore-gray-dark/50 mt-0.5">
              {completed}/{total} ejercicios completados
            </p>
          )}
        </div>
        {daily_log.is_closed && (
          <span className="text-xs bg-kore-gray-light/40 text-kore-gray-dark/50 px-2 py-1 rounded-full">
            Registro cerrado
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="h-2 rounded-full bg-kore-gray-light/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {program_day.exercises.length === 0 ? (
        <div className="text-center py-12 text-sm text-kore-gray-dark/40">
          {program_day.day_type === 'rest'
            ? 'Día de descanso completo. ¡Recupera energía!'
            : 'Sin ejercicios programados para hoy.'}
        </div>
      ) : (
        <div className="space-y-3">
          {program_day.exercises.map((pe) => (
            <ExerciseCard
              key={pe.id}
              programExercise={pe}
              exerciseLog={logMap[pe.id]}
              logClosed={daily_log.is_closed}
              onStatusChange={(exLogId, status) => onStatusChange(exLogId, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
