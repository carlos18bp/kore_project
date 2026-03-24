'use client';

import { useEffect, useState } from 'react';
import { useNutritionStore, NutritionFormData, NutritionHabit } from '@/lib/stores/nutritionStore';
import { WHATSAPP_URL } from '@/lib/constants';

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
    <div className="flex items-center gap-4 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-white/60">
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

type HabitItem = { label: string; status: 'good' | 'improve' | 'neutral'; detail: string };

function analyzeHabits(entry: NutritionHabit): { strengths: HabitItem[]; improvements: HabitItem[]; summary: string } {
  const items: HabitItem[] = [];
  const meals = entry.meals_per_day;
  items.push(meals >= 3 && meals <= 5
    ? { label: 'Comidas al d\u00eda', status: 'good', detail: `${meals} comidas \u2014 frecuencia adecuada` }
    : { label: 'Comidas al d\u00eda', status: 'improve', detail: meals < 3 ? 'Pocas comidas. Intenta distribuir mejor tu alimentaci\u00f3n.' : 'Muchas comidas. Revisa si todas son necesarias.' }
  );
  const water = parseFloat(entry.water_liters);
  items.push(water >= 2
    ? { label: 'Agua', status: 'good', detail: `${water}L al d\u00eda \u2014 buena hidrataci\u00f3n` }
    : { label: 'Agua', status: 'improve', detail: `${water}L al d\u00eda \u2014 intenta llegar a 2L o m\u00e1s` }
  );
  items.push(entry.fruit_weekly >= 7
    ? { label: 'Frutas', status: 'good', detail: `${entry.fruit_weekly} veces/semana \u2014 excelente` }
    : { label: 'Frutas', status: 'improve', detail: `${entry.fruit_weekly} veces/semana \u2014 intenta consumir fruta a diario` }
  );
  items.push(entry.vegetable_weekly >= 7
    ? { label: 'Verduras', status: 'good', detail: `${entry.vegetable_weekly} veces/semana \u2014 excelente` }
    : { label: 'Verduras', status: 'improve', detail: `${entry.vegetable_weekly} veces/semana \u2014 intenta incluir verduras a diario` }
  );
  items.push(entry.protein_frequency >= 4
    ? { label: 'Prote\u00edna', status: 'good', detail: 'Consumo frecuente de prote\u00edna \u2014 favorece tu masa muscular' }
    : { label: 'Prote\u00edna', status: 'improve', detail: 'Aumentar la prote\u00edna puede mejorar tu recuperaci\u00f3n y composici\u00f3n corporal' }
  );
  items.push(entry.ultraprocessed_weekly <= 3
    ? { label: 'Ultraprocesados', status: 'good', detail: `${entry.ultraprocessed_weekly} veces/semana \u2014 consumo bajo` }
    : { label: 'Ultraprocesados', status: 'improve', detail: `${entry.ultraprocessed_weekly} veces/semana \u2014 reducir mejora tu salud general` }
  );
  items.push(entry.sugary_drinks_weekly <= 2
    ? { label: 'Bebidas azucaradas', status: 'good', detail: `${entry.sugary_drinks_weekly} veces/semana \u2014 consumo controlado` }
    : { label: 'Bebidas azucaradas', status: 'improve', detail: `${entry.sugary_drinks_weekly} veces/semana \u2014 reducirlas mejora tu perfil metab\u00f3lico` }
  );
  items.push(entry.eats_breakfast
    ? { label: 'Desayuno', status: 'good', detail: 'Desayunas regularmente \u2014 buen h\u00e1bito' }
    : { label: 'Desayuno', status: 'improve', detail: 'No desayunar con regularidad puede afectar tu energ\u00eda y rendimiento' }
  );

  const strengths = items.filter(i => i.status === 'good');
  const improvements = items.filter(i => i.status === 'improve');

  let summary = '';
  if (improvements.length === 0) {
    summary = 'Tus h\u00e1bitos alimentarios son muy favorables. Sigue as\u00ed para sostener tu proceso.';
  } else if (improvements.length <= 2) {
    summary = `Tienes h\u00e1bitos favorables en general. Mejorar en ${improvements.map(i => i.label.toLowerCase()).join(' y ')} puede potenciar a\u00fan m\u00e1s tu proceso.`;
  } else {
    summary = 'Hay varias \u00e1reas de tu alimentaci\u00f3n que puedes mejorar. Los cambios peque\u00f1os y sostenidos generan los mejores resultados.';
  }

  return { strengths, improvements, summary };
}

function HabitAnalysis({ entry }: { entry: NutritionHabit }) {
  const { strengths, improvements, summary } = analyzeHabits(entry);
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm space-y-4">
      <div>
        <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-2">Tu lectura</p>
        <p className="text-sm text-kore-gray-dark/80 leading-relaxed">{summary}</p>
      </div>
      {strengths.length > 0 && (
        <div>
          <p className="text-xs text-green-700/70 uppercase tracking-wider font-medium mb-1.5">Fortalezas</p>
          <div className="space-y-1.5">
            {strengths.map(s => (
              <div key={s.label} className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-kore-gray-dark">{s.label}</span>
                  <p className="text-xs text-kore-gray-dark/50">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {improvements.length > 0 && (
        <div>
          <p className="text-xs text-amber-700/70 uppercase tracking-wider font-medium mb-1.5">\u00c1reas por mejorar</p>
          <div className="space-y-1.5">
            {improvements.map(s => (
              <div key={s.label} className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-kore-gray-dark">{s.label}</span>
                  <p className="text-xs text-kore-gray-dark/50">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="pt-2 border-t border-kore-gray-light/20">
        <p className="text-xs text-kore-gray-dark/40 leading-relaxed">Tu entrenador usar\u00e1 esta informaci\u00f3n junto con tus otros indicadores para orientar mejor tu proceso.</p>
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
    <section className="min-h-screen bg-kore-cream">
    <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16 max-w-3xl mx-auto">
      <div className="mb-8 xl:mb-10">
        <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu salud</p>
        <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">Mi Nutrici\u00f3n</h1>
        <p className="text-sm text-kore-gray-dark/50 mt-1">
          Registra tus h\u00e1bitos alimentarios semanalmente para darle contexto a tu proceso K\u00d3RE.
        </p>
      </div>

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

      {/* Latest result + Analysis */}
      {latest && !showForm && (
        <div className="space-y-4 mb-8">
          <ScoreCard entry={latest} />
          <HabitAnalysis entry={latest} />
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

      {/* WhatsApp CTA */}
      {latest && !showForm && (
        <a
          href={`${WHATSAPP_URL}&text=${encodeURIComponent('Hola, me gustar\u00eda solicitar un plan nutricional personalizado en K\u00d3RE.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full mb-8 p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <p className="font-heading text-sm font-semibold">Solicitar plan nutricional personalizado</p>
              <p className="text-xs text-white/70">Servicio adicional con acompa\u00f1amiento profesional</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-white/60 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </a>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 p-6 shadow-sm mb-8 space-y-6">
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
    </section>
  );
}
