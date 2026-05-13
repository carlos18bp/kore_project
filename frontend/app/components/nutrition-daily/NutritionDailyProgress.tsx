'use client';

import type { MealEntry } from '@/lib/stores/nutritionDailyStore';

const BLOCK_LABEL: Record<string, string> = {
  desayuno: 'Desayuno',
  media_manana: 'Media mañana',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
};

export default function NutritionDailyProgress({ entries }: { entries: MealEntry[] }) {
  const completed = entries.filter((e) => e.status === 'completed').length;
  const total = entries.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-kore-gray-dark">Comidas de hoy</p>
        <span className="text-xs font-bold text-kore-red">{completed}/{total}</span>
      </div>
      <div className="flex gap-1.5 mb-3">
        {entries.map((e) => (
          <div
            key={e.id}
            title={BLOCK_LABEL[e.meal_block]}
            className={`flex-1 h-2 rounded-full transition-colors ${
              e.status === 'completed' ? 'bg-kore-red' :
              e.status === 'skipped' ? 'bg-gray-300' :
              'bg-kore-red/15'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-kore-gray-dark/50">{pct}% completado</p>
    </div>
  );
}
