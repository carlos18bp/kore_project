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

const PERIMETER_FIELDS = [
  { key: 'brazo_relajado', label: 'Brazo relajado', bilateral: true },
  { key: 'brazo_flexionado', label: 'Brazo flexionado', bilateral: true },
  { key: 'antebrazo', label: 'Antebrazo', bilateral: true },
  { key: 'muneca', label: 'Muñeca', bilateral: true },
  { key: 'pecho', label: 'Pecho', bilateral: false },
  { key: 'cintura', label: 'Cintura', bilateral: false },
  { key: 'gluteos', label: 'Glúteos', bilateral: false },
  { key: 'muslo', label: 'Muslo', bilateral: true },
  { key: 'pantorrilla', label: 'Pantorrilla', bilateral: true },
  { key: 'tobillo', label: 'Tobillo', bilateral: true },
];

const SKINFOLD_FIELDS = [
  { key: 'triceps', label: 'Tríceps', bilateral: true },
  { key: 'biceps', label: 'Bíceps', bilateral: true },
  { key: 'subescapular', label: 'Sub Escapular', bilateral: true },
  { key: 'cresta_iliaca', label: 'Cresta Ilíaca', bilateral: true },
  { key: 'supraespinal', label: 'Supraespinal', bilateral: false },
  { key: 'abdominal', label: 'Abdominal', bilateral: false },
  { key: 'muslo', label: 'Muslo', bilateral: true },
  { key: 'pantorrilla', label: 'Pantorrilla', bilateral: true },
];

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

function BilateralRow({ label, keyBase, data, onChange, unit }: {
  label: string; keyBase: string; data: Record<string, string>; onChange: (key: string, val: string) => void; unit: string;
  bilateral?: boolean;
}) {
  const inputClass = "w-full px-2.5 py-2 rounded-lg border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition text-center";
  return (
    <tr className="border-b border-kore-gray-light/20">
      <td className="py-2 pr-3 text-sm text-kore-gray-dark font-medium">{label} <span className="text-xs text-kore-gray-dark/40">({unit})</span></td>
      <td className="py-2 px-1 w-24">
        <input type="number" step="0.1" value={data[`${keyBase}_d`] || ''} onChange={(e) => onChange(`${keyBase}_d`, e.target.value)} className={inputClass} placeholder="—" />
      </td>
      <td className="py-2 px-1 w-24">
        <input type="number" step="0.1" value={data[`${keyBase}_i`] || ''} onChange={(e) => onChange(`${keyBase}_i`, e.target.value)} className={inputClass} placeholder="—" />
      </td>
    </tr>
  );
}

function SingleRow({ label, keyName, data, onChange, unit }: {
  label: string; keyName: string; data: Record<string, string>; onChange: (key: string, val: string) => void; unit: string;
}) {
  const inputClass = "w-full px-2.5 py-2 rounded-lg border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition text-center";
  return (
    <tr className="border-b border-kore-gray-light/20">
      <td className="py-2 pr-3 text-sm text-kore-gray-dark font-medium">{label} <span className="text-xs text-kore-gray-dark/40">({unit})</span></td>
      <td colSpan={2} className="py-2 px-1">
        <input type="number" step="0.1" value={data[keyName] || ''} onChange={(e) => onChange(keyName, e.target.value)} className={inputClass} placeholder="—" />
      </td>
    </tr>
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
  const [showPerimeters, setShowPerimeters] = useState(false);
  const [showSkinfolds, setShowSkinfolds] = useState(false);
  const [form, setForm] = useState<AnthropometryFormData>({
    weight_kg: '', height_cm: '', waist_cm: '', hip_cm: '',
    perimeters: {}, skinfolds: {}, notes: '',
  });
  const [justCreated, setJustCreated] = useState<AnthropometryEvaluation | null>(null);

  useEffect(() => {
    if (clientId) fetchEvaluations(clientId);
  }, [clientId, fetchEvaluations]);

  const handleBasicChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const handlePerimeterChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, perimeters: { ...prev.perimeters, [key]: value } }));
  };
  const handleSkinfoldChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, skinfolds: { ...prev.skinfolds, [key]: value } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    const result = await createEvaluation(clientId, form);
    if (result) {
      setJustCreated(result);
      setShowForm(false);
      setForm({ weight_kg: '', height_cm: '', waist_cm: '', hip_cm: '', perimeters: {}, skinfolds: {}, notes: '' });
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

        {!showForm && (
          <button onClick={() => setShowForm(true)} className="mb-6 inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium py-2.5 px-5 rounded-xl transition-colors text-sm cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva evaluación
          </button>
        )}

        {/* ══════ FORM ══════ */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* Basic measurements */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Datos básicos</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Peso (kg) *</label>
                  <input type="number" step="0.1" required value={form.weight_kg} onChange={(e) => handleBasicChange('weight_kg', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Estatura (cm) *</label>
                  <input type="number" step="0.1" required value={form.height_cm} onChange={(e) => handleBasicChange('height_cm', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Cintura (cm) *</label>
                  <input type="number" step="0.1" required value={form.waist_cm} onChange={(e) => handleBasicChange('waist_cm', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Glúteos (cm) *</label>
                  <input type="number" step="0.1" required value={form.hip_cm} onChange={(e) => handleBasicChange('hip_cm', e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Perimeters section */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
              <button type="button" onClick={() => setShowPerimeters(!showPerimeters)} className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-kore-cream/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  </div>
                  <span className="font-heading text-base font-semibold text-kore-gray-dark">Perímetros (cm)</span>
                </div>
                <svg className={`w-5 h-5 text-kore-gray-dark/40 transition-transform ${showPerimeters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showPerimeters && (
                <div className="px-5 pb-5">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-kore-gray-light/30">
                        <th className="text-left text-xs text-kore-gray-dark/50 uppercase tracking-wider py-2 font-medium">Medida</th>
                        <th className="text-center text-xs text-kore-gray-dark/50 uppercase tracking-wider py-2 font-medium w-24">Dcha.</th>
                        <th className="text-center text-xs text-kore-gray-dark/50 uppercase tracking-wider py-2 font-medium w-24">Izda.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERIMETER_FIELDS.map((f) =>
                        f.bilateral ? (
                          <BilateralRow key={f.key} label={f.label} keyBase={f.key} data={form.perimeters} onChange={handlePerimeterChange} unit="cm" />
                        ) : (
                          <SingleRow key={f.key} label={f.label} keyName={f.key} data={form.perimeters} onChange={handlePerimeterChange} unit="cm" />
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Skinfolds section */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
              <button type="button" onClick={() => setShowSkinfolds(!showSkinfolds)} className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-kore-cream/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-kore-burgundy/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-kore-burgundy" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </div>
                  <span className="font-heading text-base font-semibold text-kore-gray-dark">Pliegues cutáneos (mm)</span>
                </div>
                <svg className={`w-5 h-5 text-kore-gray-dark/40 transition-transform ${showSkinfolds ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showSkinfolds && (
                <div className="px-5 pb-5">
                  <p className="text-xs text-kore-gray-dark/50 mb-3">Con 4+ pliegues se calcula el % de grasa por Jackson-Pollock (más preciso).</p>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-kore-gray-light/30">
                        <th className="text-left text-xs text-kore-gray-dark/50 uppercase tracking-wider py-2 font-medium">Pliegue</th>
                        <th className="text-center text-xs text-kore-gray-dark/50 uppercase tracking-wider py-2 font-medium w-24">Dcha.</th>
                        <th className="text-center text-xs text-kore-gray-dark/50 uppercase tracking-wider py-2 font-medium w-24">Izda.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SKINFOLD_FIELDS.map((f) =>
                        f.bilateral ? (
                          <BilateralRow key={f.key} label={f.label} keyBase={f.key} data={form.skinfolds} onChange={handleSkinfoldChange} unit="mm" />
                        ) : (
                          <SingleRow key={f.key} label={f.label} keyName={f.key} data={form.skinfolds} onChange={handleSkinfoldChange} unit="mm" />
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notes + Submit */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Observaciones</label>
              <textarea value={form.notes} onChange={(e) => handleBasicChange('notes', e.target.value)} rows={2} className={inputClass + ' resize-none mb-4'} placeholder="Notas adicionales..." />
              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className="bg-kore-red hover:bg-kore-red-dark text-white font-medium py-2.5 px-6 rounded-xl transition-colors text-sm disabled:opacity-60 cursor-pointer">
                  {submitting ? 'Calculando...' : 'Calcular y guardar'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark font-medium py-2.5 px-6 rounded-xl transition-colors text-sm cursor-pointer">
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ══════ RESULTS ══════ */}
        {latest && !showForm && (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Última evaluación</h2>
                <p className="text-xs text-kore-gray-dark/40 mt-0.5">Método grasa: {latest.bf_method === 'jackson_pollock' ? 'Jackson-Pollock (pliegues)' : 'Deurenberg (IMC)'}{latest.sum_skinfolds ? ` · Σ pliegues: ${latest.sum_skinfolds} mm` : ''}</p>
              </div>
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

            <div className="mt-4 pt-4 border-t border-kore-gray-light/30 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${latest.waist_risk_color === 'green' ? 'bg-green-500' : latest.waist_risk_color === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`} />
              <span className="text-sm text-kore-gray-dark">Riesgo abdominal: <strong>{latest.waist_risk}</strong> (cintura: {latest.waist_cm} cm)</span>
            </div>

            {/* Asymmetries */}
            {latest.asymmetries && Object.keys(latest.asymmetries).length > 0 && (
              <div className="mt-3 pt-3 border-t border-kore-gray-light/30">
                <p className="text-xs text-amber-700 uppercase tracking-wider font-medium mb-2">Asimetrías detectadas (&gt;10%)</p>
                <div className="space-y-1">
                  {Object.entries(latest.asymmetries).map(([key, asym]) => (
                    <div key={key} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                      <span>Dcha: {asym.d} / Izda: {asym.i} ({asym.diff_pct}% diferencia)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {latest.notes && (
              <div className="mt-3 pt-3 border-t border-kore-gray-light/30">
                <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1">Observaciones</p>
                <p className="text-sm text-kore-gray-dark/70">{latest.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ══════ HISTORY ══════ */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : evaluations.length > 0 && !showForm ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Historial</h2>
            <div className="space-y-2">
              {evaluations.map((ev, i) => {
                const date = new Date(ev.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <div key={ev.id} className={`flex items-center gap-4 p-3 rounded-xl ${i === 0 ? 'bg-kore-red/5 border border-kore-red/20' : 'hover:bg-kore-cream/50'} transition-colors`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-kore-red/10' : 'bg-kore-cream'}`}>
                      <svg className={`w-5 h-5 ${i === 0 ? 'text-kore-red' : 'text-kore-gray-dark/30'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-kore-gray-dark">{date}{i === 0 && <span className="text-xs text-kore-red ml-2">Más reciente</span>}</p>
                      <p className="text-xs text-kore-gray-dark/50">IMC {ev.bmi} · Grasa {ev.body_fat_pct}% · Peso {ev.weight_kg} kg</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !showForm && evaluations.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/60 shadow-sm text-center">
            <p className="text-sm text-kore-gray-dark/50">No hay evaluaciones de antropometría para este cliente.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
