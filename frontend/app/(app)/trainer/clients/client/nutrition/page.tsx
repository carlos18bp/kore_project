'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNutritionStore, NutritionHabit } from '@/lib/stores/nutritionStore';

const COLOR_MAP: Record<string, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  green: 'bg-emerald-500',
};

const COLOR_TEXT: Record<string, string> = {
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  green: 'text-emerald-600',
};

const COLOR_RING: Record<string, string> = {
  red: 'ring-red-200',
  yellow: 'ring-yellow-200',
  green: 'ring-emerald-200',
};

const HABIT_LABELS: Record<string, string> = {
  meals_per_day: 'Comidas al día',
  water_liters: 'Agua (L/día)',
  fruit_weekly: 'Frutas (veces/semana)',
  vegetable_weekly: 'Verduras (veces/semana)',
  protein_frequency: 'Proteína (frecuencia)',
  ultraprocessed_weekly: 'Ultraprocesados (veces/semana)',
  sugary_drinks_weekly: 'Bebidas azucaradas (veces/semana)',
  eats_breakfast: 'Desayuna regularmente',
};

function EntryCard({ entry }: { entry: NutritionHabit }) {
  const score = entry.habit_score ? parseFloat(entry.habit_score) : 0;
  const pct = Math.min(score / 10, 1) * 100;
  const date = new Date(entry.created_at).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="bg-white rounded-2xl border border-kore-gray-light/40 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ring-4 ${COLOR_RING[entry.habit_color] || 'ring-gray-200'} ${COLOR_MAP[entry.habit_color] || 'bg-gray-400'}`}>
            <span className="text-white font-bold">{score}</span>
          </div>
          <div>
            <p className={`font-semibold ${COLOR_TEXT[entry.habit_color] || 'text-gray-600'}`}>
              {entry.habit_category}
            </p>
            <p className="text-xs text-kore-gray-dark/40">{date}</p>
          </div>
        </div>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
        <div
          className={`h-2.5 rounded-full ${COLOR_MAP[entry.habit_color] || 'bg-gray-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {Object.entries(HABIT_LABELS).map(([key, label]) => {
          const val = entry[key as keyof NutritionHabit];
          const display = typeof val === 'boolean' ? (val ? 'Sí' : 'No') : String(val ?? '-');
          return (
            <div key={key} className="flex justify-between bg-kore-cream/30 rounded-lg px-3 py-2">
              <span className="text-kore-gray-dark/60 text-xs">{label}</span>
              <span className="text-kore-gray-dark font-medium text-xs">{display}</span>
            </div>
          );
        })}
      </div>

      {entry.notes && (
        <div className="mt-3 p-3 bg-kore-cream/20 rounded-lg">
          <p className="text-xs text-kore-gray-dark/60">
            <strong>Notas:</strong> {entry.notes}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TrainerClientNutritionPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');
  const { entries, loading, error, fetchClientEntries } = useNutritionStore();

  useEffect(() => {
    if (clientId) {
      fetchClientEntries(parseInt(clientId));
    }
  }, [clientId, fetchClientEntries]);

  if (!clientId) {
    return <div className="p-8 text-kore-gray-dark/40">Cliente no especificado.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark mb-2">Nutrición del Cliente</h1>
      <p className="text-sm text-kore-gray-dark/50 mb-8">
        Historial de hábitos alimentarios reportados por el cliente.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && entries.length === 0 && (
        <div className="text-center py-12 text-kore-gray-dark/40">Cargando...</div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-12">
          <p className="text-kore-gray-dark/40">El cliente aún no ha registrado hábitos alimentarios.</p>
        </div>
      )}

      <div className="space-y-6">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
