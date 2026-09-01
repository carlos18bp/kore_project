'use client';

import { useEffect, useState } from 'react';
import {
  useTrainerSettingsStore,
  type Difficulty,
  type TrainerSettings,
} from '@/lib/stores/trainerSettingsStore';

const DIFFICULTIES: Array<{ key: Difficulty; label: string; hint: string }> = [
  { key: 'easy', label: 'Fácil', hint: 'Más puntos por acción. Para arrancar y enganchar.' },
  { key: 'medium', label: 'Medio', hint: 'El equilibrio por defecto.' },
  { key: 'hard', label: 'Difícil', hint: 'Menos puntos, penalizaciones más altas.' },
];

const ACTION_LABEL: Record<string, string> = {
  physical_test_passed: 'Test físico aprobado',
  session_attended: 'Asistir a la sesión',
  session_rated: 'Calificar la sesión',
  workout_day: 'Día de entrenamiento',
  meal_photo: 'Comida con foto',
  checkin: 'Check-in diario',
  water_goal: 'Meta de agua',
  no_show_penalty: 'No asistir (penalización)',
  late_reschedule_penalty: 'Reprogramar tarde (penalización)',
};

export default function TrainerSettingsPage() {
  const settings = useTrainerSettingsStore((s) => s.settings);
  const loading = useTrainerSettingsStore((s) => s.loading);
  const saving = useTrainerSettingsStore((s) => s.saving);
  const error = useTrainerSettingsStore((s) => s.error);
  const fetchSettings = useTrainerSettingsStore((s) => s.fetchSettings);
  const updateSettings = useTrainerSettingsStore((s) => s.updateSettings);

  const [form, setForm] = useState<Partial<TrainerSettings>>({});
  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const field = <K extends keyof TrainerSettings>(key: K): TrainerSettings[K] | undefined =>
    (form[key] ?? settings?.[key]) as TrainerSettings[K] | undefined;

  const confirmDifficulty = async () => {
    if (!pendingDifficulty) return;
    // Empty maps are the signal the backend uses to reseed them from the preset.
    await updateSettings({
      difficulty: pendingDifficulty,
      action_values: {},
      streak_bonuses: {},
    });
    setPendingDifficulty(null);
  };

  const saveRules = async () => {
    const ok = await updateSettings({
      training_day_threshold: Number(field('training_day_threshold')),
      nutrition_min_meals: Number(field('nutrition_min_meals')),
      water_goal_glasses: Number(field('water_goal_glasses')),
      meal_review_days: Number(field('meal_review_days')),
      require_workout_captures: !!field('require_workout_captures'),
      reschedule_window_hours: Number(field('reschedule_window_hours')),
    });
    setSaved(ok);
  };

  const actionValues = settings?.action_values ?? {};

  return (
    <section className="min-h-screen bg-kore-cream">
      <div
        data-testid="trainer-settings"
        className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5"
      >
        <h1 className="text-lg font-bold text-kore-gray-dark">Configuración</h1>

        {error && <p className="text-sm font-semibold text-kore-red">{error}</p>}
        {loading && <p className="text-sm text-kore-gray-dark/50">Cargando…</p>}

        {/* ── Dificultad ── */}
        <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-kore-gray-dark">Dificultad</h2>
            <p className="text-xs text-kore-gray-dark/50">
              Define cuántos puntos otorga cada acción y cuánto pesan las penalizaciones.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((d) => {
              const active = field('difficulty') === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  data-testid={`difficulty-${d.key}`}
                  onClick={() => !active && setPendingDifficulty(d.key)}
                  className={`rounded-xl p-3 text-left border transition-colors ${
                    active
                      ? 'bg-kore-red text-white border-transparent'
                      : 'bg-white/60 text-kore-gray-dark/50 border-kore-gray-light/40'
                  }`}
                >
                  <span className="block text-sm font-bold">{d.label}</span>
                  <span className="block text-[11px] leading-snug mt-1 opacity-80">{d.hint}</span>
                </button>
              );
            })}
          </div>

          {!!Object.keys(actionValues).length && (
            <ul className="divide-y divide-kore-gray-light/40">
              {Object.entries(actionValues).map(([action, value]) => (
                <li key={action} className="flex items-center justify-between py-2">
                  <span className="text-xs text-kore-gray-dark/80">
                    {ACTION_LABEL[action] ?? action}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      value < 0 ? 'text-kore-red' : 'text-kore-gray-dark'
                    }`}
                  >
                    {value > 0 ? `+${value}` : value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Reglas de actividad ── */}
        <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-kore-gray-dark">Reglas de actividad</h2>
            <p className="text-xs text-kore-gray-dark/50">
              Qué tiene que cumplir el cliente para que el día cuente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
                Umbral de entrenamiento (%)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round((Number(field('training_day_threshold')) || 0) * 100)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    training_day_threshold: Number(e.target.value) / 100,
                  }))
                }
                className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
                Comidas mínimas
              </span>
              <input
                type="number"
                min={0}
                value={Number(field('nutrition_min_meals')) || 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nutrition_min_meals: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
                Meta de agua (vasos)
              </span>
              <input
                type="number"
                min={0}
                value={Number(field('water_goal_glasses')) || 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, water_goal_glasses: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
                Días de revisión de comidas
              </span>
              <input
                type="number"
                min={0}
                value={Number(field('meal_review_days')) || 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, meal_review_days: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
              />
            </label>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!field('require_workout_captures')}
              onChange={(e) =>
                setForm((f) => ({ ...f, require_workout_captures: e.target.checked }))
              }
            />
            <span className="text-sm text-kore-gray-dark/80">
              Exigir fotos de cámara para acreditar el entrenamiento
            </span>
          </label>
        </div>

        {/* ── Reagendamiento ── */}
        <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-bold text-kore-gray-dark">Reagendamiento</h2>
            <p className="text-xs text-kore-gray-dark/50">
              Con menos de estas horas de anticipación, el cliente <strong>no puede</strong>{' '}
              cancelar ni reprogramar. Si lo hace justo en el límite, se le aplica la penalización
              de puntos. Tú y los administradores siempre pueden hacerlo.
            </p>
          </div>

          <label className="block max-w-[200px]">
            <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
              Horas de anticipación
            </span>
            <input
              type="number"
              min={0}
              max={168}
              data-testid="reschedule-window"
              value={Number(field('reschedule_window_hours')) || 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, reschedule_window_hours: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="settings-save"
            onClick={saveRules}
            disabled={saving || loading}
            className="bg-kore-red text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {saved && <span className="text-sm text-kore-sage-deep font-semibold">Guardado</span>}
        </div>
      </div>

      {pendingDifficulty && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-kore-gray-dark">Cambiar la dificultad</h3>
            <p className="text-sm text-kore-gray-dark/80 leading-relaxed">
              Se reescribirán los puntos de cada acción y los bonos de racha con los del preset{' '}
              <strong>{DIFFICULTIES.find((d) => d.key === pendingDifficulty)?.label}</strong>. Los
              puntos que ya ganaron tus clientes no cambian.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDifficulty(null)}
                className="px-4 py-2 text-sm text-kore-gray-dark/50"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="difficulty-confirm"
                onClick={confirmDifficulty}
                disabled={saving}
                className="bg-kore-red text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Aplicando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
