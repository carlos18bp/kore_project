'use client';

import { useEffect, useState } from 'react';
import { useNutritionStore, NutritionFormData, NutritionHabit } from '@/lib/stores/nutritionStore';

const COLOR_MAP: Record<string, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  green: 'bg-emerald-500',
};

const COLOR_RING: Record<string, string> = {
  red: 'ring-red-200',
  yellow: 'ring-yellow-200',
  green: 'ring-emerald-200',
};

const COLOR_TEXT: Record<string, string> = {
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  green: 'text-emerald-600',
};

const PROTEIN_LABELS = [
  { value: 1, label: 'Nunca o casi nunca' },
  { value: 2, label: 'Pocas veces por semana' },
  { value: 3, label: 'Varios días, pero no diario' },
  { value: 4, label: 'Diario, al menos 1 comida' },
  { value: 5, label: 'Diario, en cada comida principal' },
];

const INITIAL_FORM: NutritionFormData = {
  meals_per_day: 3,
  water_liters: 2.0,
  fruit_weekly: 3,
  vegetable_weekly: 3,
  protein_frequency: 3,
  ultraprocessed_weekly: 3,
  sugary_drinks_weekly: 2,
  eats_breakfast: true,
  notes: '',
};

function ScoreCard({ entry }: { entry: NutritionHabit }) {
  const score = entry.habit_score ? parseFloat(entry.habit_score) : 0;
  const pct = Math.min(score / 10, 1) * 100;

  return (
    <div className="bg-white rounded-2xl border border-kore-gray-light/40 p-6 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ring-4 ${COLOR_RING[entry.habit_color] || 'ring-gray-200'} ${COLOR_MAP[entry.habit_color] || 'bg-gray-400'}`}>
          <span className="text-white text-xl font-bold">{score}</span>
        </div>
        <div>
          <p className={`text-lg font-semibold ${COLOR_TEXT[entry.habit_color] || 'text-gray-600'}`}>
            {entry.habit_category}
          </p>
          <p className="text-sm text-kore-gray-dark/50">Índice de hábitos alimentarios</p>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${COLOR_MAP[entry.habit_color] || 'bg-gray-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-kore-gray-dark/40 mt-1">
        <span>0</span>
        <span>10</span>
      </div>
    </div>
  );
}

function HistoryCard({ entry }: { entry: NutritionHabit }) {
  const score = entry.habit_score ? parseFloat(entry.habit_score) : 0;
  const date = new Date(entry.created_at).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-kore-gray-light/30">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${COLOR_MAP[entry.habit_color] || 'bg-gray-400'}`}>
        <span className="text-white text-sm font-bold">{score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-kore-gray-dark">{entry.habit_category}</p>
        <p className="text-xs text-kore-gray-dark/40">{date}</p>
      </div>
    </div>
  );
}

export default function MyNutritionPage() {
  const { entries, loading, submitting, error, fetchMyEntries, createEntry } = useNutritionStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NutritionFormData>(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchMyEntries();
  }, [fetchMyEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createEntry(form);
    if (result) {
      setShowForm(false);
      setForm(INITIAL_FORM);
      setSubmitted(true);
    }
  };

  const latest = entries[0] || null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark mb-2">Mi Nutrición</h1>
      <p className="text-sm text-kore-gray-dark/50 mb-8">
        Registra tus hábitos alimentarios semanalmente para darle contexto a tu proceso KÓRE.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {submitted && !error && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          Registro guardado correctamente.
        </div>
      )}

      {/* Latest result */}
      {latest && !showForm && (
        <div className="mb-8">
          <ScoreCard entry={latest} />
        </div>
      )}

      {/* New entry button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setSubmitted(false); }}
          className="w-full mb-8 py-3 px-6 rounded-xl bg-kore-red text-white font-medium hover:bg-kore-red-dark transition-colors"
        >
          Nuevo registro semanal
        </button>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-kore-gray-light/40 p-6 shadow-sm mb-8 space-y-6">
          <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Registro de hábitos</h2>

          {/* Meals per day */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              ¿Cuántas comidas haces al día?
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.meals_per_day}
              onChange={(e) => setForm({ ...form, meals_per_day: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red outline-none"
            />
          </div>

          {/* Water */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              ¿Cuántos litros de agua tomas al día?
            </label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={form.water_liters}
              onChange={(e) => setForm({ ...form, water_liters: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red outline-none"
            />
          </div>

          {/* Fruit */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              ¿Cuántas veces por semana consumes frutas?
            </label>
            <input
              type="number"
              min={0}
              max={35}
              value={form.fruit_weekly}
              onChange={(e) => setForm({ ...form, fruit_weekly: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red outline-none"
            />
          </div>

          {/* Vegetables */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              ¿Cuántas veces por semana consumes verduras?
            </label>
            <input
              type="number"
              min={0}
              max={35}
              value={form.vegetable_weekly}
              onChange={(e) => setForm({ ...form, vegetable_weekly: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red outline-none"
            />
          </div>

          {/* Protein frequency */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              ¿Con qué frecuencia consumes proteína?
            </label>
            <div className="space-y-2">
              {PROTEIN_LABELS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="protein_frequency"
                    value={opt.value}
                    checked={form.protein_frequency === opt.value}
                    onChange={() => setForm({ ...form, protein_frequency: opt.value })}
                    className="w-4 h-4 text-kore-red focus:ring-kore-red"
                  />
                  <span className="text-sm text-kore-gray-dark">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Ultraprocessed */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              ¿Cuántas veces por semana consumes ultraprocesados?
            </label>
            <input
              type="number"
              min={0}
              max={35}
              value={form.ultraprocessed_weekly}
              onChange={(e) => setForm({ ...form, ultraprocessed_weekly: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red outline-none"
            />
            <p className="text-xs text-kore-gray-dark/40 mt-1">Paquetes, snacks, comida rápida, gaseosas, etc.</p>
          </div>

          {/* Sugary drinks */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              ¿Cuántas veces por semana consumes bebidas azucaradas?
            </label>
            <input
              type="number"
              min={0}
              max={35}
              value={form.sugary_drinks_weekly}
              onChange={(e) => setForm({ ...form, sugary_drinks_weekly: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red outline-none"
            />
          </div>

          {/* Breakfast */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              ¿Desayunas regularmente?
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setForm({ ...form, eats_breakfast: true })}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  form.eats_breakfast
                    ? 'bg-kore-red text-white border-kore-red'
                    : 'bg-white text-kore-gray-dark/60 border-kore-gray-light/50 hover:border-kore-red/30'
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, eats_breakfast: false })}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  !form.eats_breakfast
                    ? 'bg-kore-red text-white border-kore-red'
                    : 'bg-white text-kore-gray-dark/60 border-kore-gray-light/50 hover:border-kore-red/30'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-kore-gray-dark mb-2">
              Observaciones (opcional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 focus:ring-2 focus:ring-kore-red/20 focus:border-kore-red outline-none resize-none"
              placeholder="¿Algo que quieras agregar sobre tu alimentación esta semana?"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      {entries.length > 0 && (
        <div className="mb-8">
          <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Historial</h2>
          <div className="space-y-3">
            {entries.map((entry) => (
              <HistoryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* Scientific basis */}
      <div className="bg-kore-cream/50 rounded-2xl p-6 border border-kore-gray-light/20">
        <h3 className="font-heading text-base font-semibold text-kore-gray-dark mb-3">Base científica</h3>
        <ul className="space-y-2 text-xs text-kore-gray-dark/60">
          <li>OMS (2020). Healthy diet fact sheet.</li>
          <li>Monteiro CA et al. (2019). Ultra-processed foods — NOVA classification. Public Health Nutr.</li>
          <li>ISSN (2017). Position stand: protein and exercise. JISSN, 14:20.</li>
          <li>EFSA (2010). Scientific Opinion on dietary reference values for water.</li>
          <li>Cahill LE et al. (2013). Breakfast eating and coronary heart disease. Circulation.</li>
          <li>AHA (2020). Dietary sugars intake and cardiovascular health.</li>
        </ul>
      </div>

      {loading && entries.length === 0 && (
        <div className="text-center py-12 text-kore-gray-dark/40">Cargando...</div>
      )}
    </div>
  );
}
