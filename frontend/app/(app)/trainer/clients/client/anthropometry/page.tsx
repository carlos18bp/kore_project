'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAnthropometryStore, type AnthropometryFormData, type AnthropometryEvaluation } from '@/lib/stores/anthropometryStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

const COLOR_MAP: Record<string, string> = {
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-amber-100 text-amber-700 border-amber-200',
  red: 'bg-red-100 text-red-600 border-red-200',
};

function IndexCard({ label, value, unit, category, color }: {
  label: string; value: string | number; unit?: string; category: string; color: string;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.green;
  return (
    <div className={`rounded-xl border p-4 ${c}`}>
      <p className="text-xs uppercase tracking-wider font-medium opacity-70 mb-1">{label}</p>
      <p className="font-heading text-2xl font-bold">{value}{unit && <span className="text-sm font-normal ml-1">{unit}</span>}</p>
      <p className="text-xs font-medium mt-1">{category}</p>
    </div>
  );
}

function EvalHistoryItem({ ev, isLatest }: { ev: AnthropometryEvaluation; isLatest: boolean }) {
  const date = new Date(ev.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className={`flex items-center gap-4 p-3 rounded-xl ${isLatest ? 'bg-kore-red/5 border border-kore-red/20' : 'hover:bg-kore-cream/50'} transition-colors`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isLatest ? 'bg-kore-red/10' : 'bg-kore-cream'}`}>
        <svg className={`w-5 h-5 ${isLatest ? 'text-kore-red' : 'text-kore-gray-dark/30'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-kore-gray-dark">{date}{isLatest && <span className="text-xs text-kore-red ml-2">Más reciente</span>}</p>
        <p className="text-xs text-kore-gray-dark/50">IMC {ev.bmi} · Grasa {ev.body_fat_pct}% · Peso {ev.weight_kg} kg</p>
      </div>
    </div>
  );
}

export default function TrainerAnthropometryWrapper() {
  return <Suspense><TrainerAnthropometryPage /></Suspense>;
}

function TrainerAnthropometryPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const clientId = Number(searchParams.get('id'));
  const { evaluations, loading, submitting, error, fetchEvaluations, createEvaluation } = useAnthropometryStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const [showForm, setShowForm] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [form, setForm] = useState<AnthropometryFormData>({
    weight_kg: '', height_cm: '', waist_cm: '', hip_cm: '',
    notes: '',
  });
  const [justCreated, setJustCreated] = useState<AnthropometryEvaluation | null>(null);

  useEffect(() => {
    if (clientId) fetchEvaluations(clientId);
  }, [clientId, fetchEvaluations]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    const result = await createEvaluation(clientId, form);
    if (result) {
      setJustCreated(result);
      setShowForm(false);
      setForm({ weight_kg: '', height_cm: '', waist_cm: '', hip_cm: '', notes: '' });
    }
  };

  const latest = justCreated || evaluations[0] || null;

  if (!user) return null;

  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition";

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16">
        <div data-hero="badge" className="mb-8">
          <Link href={`/trainer/clients/client?id=${clientId}`} className="inline-flex items-center gap-1 text-xs text-kore-gray-dark/40 hover:text-kore-red transition-colors mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Volver al cliente
          </Link>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">Antropometría</h1>
        </div>

        {error && (
          <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-kore-red">{error}</p>
          </div>
        )}

        {/* New evaluation button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-6 inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium py-2.5 px-5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva evaluación
          </button>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm mb-6">
            <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Nueva evaluación</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Peso (kg) *</label>
                <input type="number" step="0.1" required value={form.weight_kg} onChange={(e) => handleChange('weight_kg', e.target.value)} className={inputClass} placeholder="70.0" />
              </div>
              <div>
                <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Estatura (cm) *</label>
                <input type="number" step="0.1" required value={form.height_cm} onChange={(e) => handleChange('height_cm', e.target.value)} className={inputClass} placeholder="175.0" />
              </div>
              <div>
                <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Cintura (cm) *</label>
                <input type="number" step="0.1" required value={form.waist_cm} onChange={(e) => handleChange('waist_cm', e.target.value)} className={inputClass} placeholder="85.0" />
              </div>
              <div>
                <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Cadera (cm) *</label>
                <input type="number" step="0.1" required value={form.hip_cm} onChange={(e) => handleChange('hip_cm', e.target.value)} className={inputClass} placeholder="95.0" />
              </div>
            </div>

            {/* Optional fields toggle */}
            <button type="button" onClick={() => setShowOptional(!showOptional)} className="text-xs text-kore-red font-medium mb-3 cursor-pointer hover:underline">
              {showOptional ? 'Ocultar campos opcionales' : 'Mostrar campos opcionales (pecho, abdomen, brazos, muslo, pantorrilla, cuello)'}
            </button>

            {showOptional && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[
                  { key: 'chest_cm', label: 'Pecho (cm)' },
                  { key: 'abdomen_cm', label: 'Abdomen (cm)' },
                  { key: 'arm_relaxed_cm', label: 'Brazo relajado (cm)' },
                  { key: 'arm_flexed_cm', label: 'Brazo contraído (cm)' },
                  { key: 'thigh_cm', label: 'Muslo (cm)' },
                  { key: 'calf_cm', label: 'Pantorrilla (cm)' },
                  { key: 'neck_cm', label: 'Cuello (cm)' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">{f.label}</label>
                    <input type="number" step="0.1" value={(form as Record<string, string>)[f.key] || ''} onChange={(e) => handleChange(f.key, e.target.value)} className={inputClass} />
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Observaciones</label>
              <textarea value={form.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} rows={2} className={inputClass + ' resize-none'} placeholder="Notas adicionales..." />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="bg-kore-red hover:bg-kore-red-dark text-white font-medium py-2.5 px-6 rounded-xl transition-colors text-sm disabled:opacity-60 cursor-pointer">
                {submitting ? 'Calculando...' : 'Calcular y guardar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark font-medium py-2.5 px-6 rounded-xl transition-colors text-sm cursor-pointer">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Latest results */}
        {latest && !showForm && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Última evaluación</h2>
              <span className="text-xs text-kore-gray-dark/40">{new Date(latest.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <IndexCard label="IMC" value={latest.bmi} category={latest.bmi_category} color={latest.bmi_color} />
              <IndexCard label="Cintura-Cadera" value={latest.waist_hip_ratio} category={latest.whr_risk} color={latest.whr_color} />
              <IndexCard label="Cintura-Estatura" value={latest.waist_height_ratio} category={latest.whe_risk} color={latest.whe_color} />
              <IndexCard label="% Grasa" value={latest.body_fat_pct} unit="%" category={latest.bf_category} color={latest.bf_color} />
              <IndexCard label="Masa grasa" value={latest.fat_mass_kg} unit="kg" category="Grasa corporal" color={latest.bf_color} />
              <IndexCard label="Masa libre" value={latest.lean_mass_kg} unit="kg" category="Músculo, hueso, agua" color="green" />
            </div>

            {/* Waist risk */}
            <div className="mt-4 pt-4 border-t border-kore-gray-light/30">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${latest.waist_risk_color === 'green' ? 'bg-green-500' : latest.waist_risk_color === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span className="text-sm text-kore-gray-dark">Riesgo abdominal: <strong>{latest.waist_risk}</strong> (cintura: {latest.waist_cm} cm)</span>
              </div>
            </div>

            {latest.notes && (
              <div className="mt-3 pt-3 border-t border-kore-gray-light/30">
                <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1">Observaciones</p>
                <p className="text-sm text-kore-gray-dark/70">{latest.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : evaluations.length > 0 ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Historial de evaluaciones</h2>
            <div className="space-y-2">
              {evaluations.map((ev, i) => (
                <EvalHistoryItem key={ev.id} ev={ev} isLatest={i === 0} />
              ))}
            </div>
          </div>
        ) : !showForm ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/60 shadow-sm text-center">
            <p className="text-sm text-kore-gray-dark/50">No hay evaluaciones de antropometría para este cliente.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
