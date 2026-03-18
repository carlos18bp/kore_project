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
  const { evaluations, loading, submitting, error, fetchEvaluations, createEvaluation, updateEvaluation, fullUpdateEvaluation, deleteEvaluation } = useAnthropometryStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const [showForm, setShowForm] = useState(false);
  const [showPerimeters, setShowPerimeters] = useState(false);
  const [showSkinfolds, setShowSkinfolds] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [showScience, setShowScience] = useState(false);
  const [editingRecs, setEditingRecs] = useState<Record<string, { result: string; action: string }>>({});
  const [recsSaved, setRecsSaved] = useState(false);
  const [form, setForm] = useState<AnthropometryFormData>({
    evaluation_date: '', weight_kg: '', height_cm: '', waist_cm: '', hip_cm: '',
    perimeters: {}, skinfolds: {}, notes: '',
  });
  const [justCreated, setJustCreated] = useState<AnthropometryEvaluation | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const emptyForm = (): AnthropometryFormData => ({
    evaluation_date: '', weight_kg: '', height_cm: '', waist_cm: '', hip_cm: '',
    perimeters: {}, skinfolds: {}, notes: '',
  });

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
    const result = editingId
      ? await fullUpdateEvaluation(clientId, editingId, form)
      : await createEvaluation(clientId, form);
    if (result) {
      setJustCreated(result);
      setShowForm(false);
      setForm(emptyForm());
      setEditingId(null);
    }
  };

  const handleEdit = (ev: AnthropometryEvaluation) => {
    const perimeters: Record<string, string> = {};
    if (ev.perimeters) {
      for (const [k, v] of Object.entries(ev.perimeters)) {
        perimeters[k] = String(v);
      }
    }
    const skinfolds: Record<string, string> = {};
    if (ev.skinfolds) {
      for (const [k, v] of Object.entries(ev.skinfolds)) {
        skinfolds[k] = String(v);
      }
    }
    setForm({
      evaluation_date: ev.evaluation_date || '',
      weight_kg: ev.weight_kg || '',
      height_cm: ev.height_cm || '',
      waist_cm: ev.waist_cm ? String(ev.waist_cm) : '',
      hip_cm: ev.hip_cm ? String(ev.hip_cm) : '',
      perimeters,
      skinfolds,
      notes: ev.notes || '',
    });
    setEditingId(ev.id);
    setJustCreated(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (evalId: number) => {
    if (!clientId) return;
    const ok = await deleteEvaluation(clientId, evalId);
    if (ok) {
      setConfirmDeleteId(null);
      if (justCreated?.id === evalId) setJustCreated(null);
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
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">{editingId ? 'Editar evaluación' : 'Datos básicos'}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Fecha del examen</label>
                  <input type="date" value={form.evaluation_date} onChange={(e) => handleBasicChange('evaluation_date', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Peso (kg) *</label>
                  <input type="number" step="0.1" required value={form.weight_kg} onChange={(e) => handleBasicChange('weight_kg', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Estatura (cm) *</label>
                  <input type="number" step="0.1" required value={form.height_cm} onChange={(e) => handleBasicChange('height_cm', e.target.value)} className={inputClass} />
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
                  <p className="text-xs text-kore-gray-dark/50 mb-3">Cintura y glúteos se usan para calcular índices de riesgo (opcionales).</p>
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
                  {submitting ? 'Calculando...' : editingId ? 'Actualizar evaluación' : 'Calcular y guardar'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()); }} className="bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark font-medium py-2.5 px-6 rounded-xl transition-colors text-sm cursor-pointer">
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ══════ RESULTS ══════ */}
        {latest && !showForm && (
          <div className="space-y-6 mb-6">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Última evaluación</h2>
                  <p className="text-xs text-kore-gray-dark/40 mt-0.5">Método grasa: {latest.bf_method === 'jackson_pollock' ? 'Jackson-Pollock (pliegues)' : 'Deurenberg (IMC)'}{latest.sum_skinfolds ? ` · Σ pliegues: ${latest.sum_skinfolds} mm` : ''}</p>
                </div>
                <span className="text-xs text-kore-gray-dark/40">{latest.evaluation_date ? new Date(latest.evaluation_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(latest.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <IndexCard label="IMC" value={latest.bmi} category={latest.bmi_category} color={latest.bmi_color} />
                {latest.waist_hip_ratio && <IndexCard label="Cintura-Cadera" value={latest.waist_hip_ratio!} category={latest.whr_risk} color={latest.whr_color} />}
                {latest.waist_height_ratio && <IndexCard label="Cintura-Estatura" value={latest.waist_height_ratio!} category={latest.whe_risk} color={latest.whe_color} />}
                <IndexCard label="% Grasa" value={latest.body_fat_pct} unit="%" category={latest.bf_category} color={latest.bf_color} />
                <IndexCard label="Masa grasa" value={latest.fat_mass_kg} unit="kg" category="Grasa corporal" color={latest.bf_color} />
                <IndexCard label="Masa libre" value={latest.lean_mass_kg} unit="kg" category="Músculo, hueso, agua" color="green" />
              </div>

              {latest.waist_risk && (
                <div className="mt-4 pt-4 border-t border-kore-gray-light/30 flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${latest.waist_risk_color === 'green' ? 'bg-green-500' : latest.waist_risk_color === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-kore-gray-dark">Riesgo abdominal: <strong>{latest.waist_risk}</strong> (cintura: {latest.waist_cm} cm)</span>
                </div>
              )}

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

            {/* ══ RECOMMENDATIONS (editable) ══ */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
              <button type="button" onClick={() => { if (!showRecs && latest.recommendations) { setEditingRecs(JSON.parse(JSON.stringify(latest.recommendations))); setRecsSaved(false); } setShowRecs(!showRecs); }} className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-kore-cream/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-kore-burgundy/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-kore-burgundy" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                  </div>
                  <span className="font-heading text-base font-semibold text-kore-gray-dark">Recomendaciones para el cliente</span>
                </div>
                <svg className={`w-5 h-5 text-kore-gray-dark/40 transition-transform ${showRecs ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {showRecs && (
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-xs text-kore-gray-dark/50">Estas recomendaciones se mostrarán al cliente en su diagnóstico. Puedes editarlas.</p>
                  {Object.entries(editingRecs).map(([key, rec]) => {
                    const labels: Record<string, string> = { bmi: 'IMC', whr: 'Cintura-Cadera', bf: '% Grasa', waist: 'Riesgo abdominal', mass: 'Composición corporal' };
                    return (
                      <div key={key} className="bg-kore-cream/30 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-kore-gray-dark/60 uppercase tracking-wider font-medium">{labels[key] || key}</p>
                        <div>
                          <label className="text-xs text-kore-gray-dark/50 mb-0.5 block">Resultado</label>
                          <textarea value={rec.result} onChange={(e) => setEditingRecs((prev) => ({ ...prev, [key]: { ...prev[key], result: e.target.value } }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-kore-gray-light/50 bg-white/70 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none" />
                        </div>
                        <div>
                          <label className="text-xs text-kore-gray-dark/50 mb-0.5 block">Acción recomendada</label>
                          <textarea value={rec.action} onChange={(e) => setEditingRecs((prev) => ({ ...prev, [key]: { ...prev[key], action: e.target.value } }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-kore-gray-light/50 bg-white/70 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none" />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3">
                    <button type="button" disabled={submitting} onClick={async () => { if (!clientId || !latest) return; const res = await updateEvaluation(clientId, latest.id, { recommendations: editingRecs }); if (res) { setRecsSaved(true); setJustCreated(res); } }} className="bg-kore-red hover:bg-kore-red-dark text-white font-medium py-2 px-5 rounded-xl transition-colors text-sm disabled:opacity-60 cursor-pointer">
                      {submitting ? 'Guardando...' : 'Guardar recomendaciones'}
                    </button>
                    {recsSaved && <span className="text-xs text-green-600 font-medium">Guardado</span>}
                  </div>
                </div>
              )}
            </div>

            {/* ══ SCIENTIFIC BASIS ══ */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
              <button type="button" onClick={() => setShowScience(!showScience)} className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-kore-cream/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-kore-wine-dark/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-kore-wine-dark" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                  </div>
                  <span className="font-heading text-base font-semibold text-kore-gray-dark">Fundamento científico</span>
                </div>
                <svg className={`w-5 h-5 text-kore-gray-dark/40 transition-transform ${showScience ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {showScience && (
                <div className="px-5 pb-5 space-y-5">
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Índice de Masa Corporal (IMC)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Fórmula:</strong> IMC = peso (kg) / estatura (m)²</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Clasificación:</strong> &lt;18.5 Bajo peso · 18.5–24.9 Saludable · 25–29.9 Sobrepeso · 30–34.9 Obesidad I · 35–39.9 Obesidad II · ≥40 Obesidad III</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">WHO (2000). <em>Obesity: preventing and managing the global epidemic</em>. WHO Technical Report Series 894.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Índice Cintura-Cadera (ICC)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Fórmula:</strong> ICC = perímetro cintura (cm) / perímetro cadera (cm)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Umbrales de riesgo:</strong> Hombres ≥0.90 riesgo moderado, ≥1.00 riesgo alto · Mujeres ≥0.80 moderado, ≥0.85 alto</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">WHO (2008). <em>Waist Circumference and Waist–Hip Ratio: Report of a WHO Expert Consultation</em>. Geneva.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Índice Cintura-Estatura (ICE)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Fórmula:</strong> ICE = perímetro cintura (cm) / estatura (cm)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Umbrales:</strong> &lt;0.50 saludable · 0.50–0.59 riesgo moderado · ≥0.60 riesgo alto</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Ashwell, M. & Hsieh, S.D. (2005). Six reasons why the waist-to-height ratio is a rapid and effective global indicator for health risks of obesity. <em>Int J Food Sci Nutr</em>, 56(5), 303–307.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">% Grasa Corporal — Deurenberg</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Fórmula:</strong> %Grasa = (1.20 × IMC) + (0.23 × edad) − (10.8 × sexo) − 5.4 &nbsp; (sexo: 1=masculino, 0=femenino)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Uso:</strong> Se aplica cuando no hay suficientes pliegues cutáneos (&lt;4 sitios).</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Deurenberg, P. et al. (1991). Body mass index as a measure of body fatness. <em>British Journal of Nutrition</em>, 65(2), 105–114.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">% Grasa Corporal — Jackson-Pollock 7 pliegues</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Fórmula:</strong> Densidad corporal (hombres) = 1.112 − 0.00043499×Σ + 0.00000055×Σ² − 0.00028826×edad</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1">Densidad corporal (mujeres) = 1.097 − 0.00046971×Σ + 0.00000056×Σ² − 0.00012828×edad</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Conversión:</strong> %Grasa = (495 / densidad) − 450 &nbsp;(ecuación de Siri)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Sitios:</strong> Tríceps, pecho, subescapular, supraespinal, abdominal, muslo, pantorrilla (mínimo 4).</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Jackson, A.S. & Pollock, M.L. (1978). Generalized equations for predicting body density of men. <em>British Journal of Nutrition</em>, 40(3), 497–504.</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Siri, W.E. (1961). Body composition from fluid spaces and density. In <em>Techniques for Measuring Body Composition</em>, 223–244.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Riesgo Abdominal (Perímetro de cintura)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Umbrales hombres:</strong> &lt;94 cm bajo · 94–101 cm aumentado · ≥102 cm alto</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Umbrales mujeres:</strong> &lt;80 cm bajo · 80–87 cm aumentado · ≥88 cm alto</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">WHO (2008). <em>Waist Circumference and Waist–Hip Ratio: Report of a WHO Expert Consultation</em>. Geneva.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Composición Corporal</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Masa grasa (kg)</strong> = peso × (%grasa / 100)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Masa libre de grasa (kg)</strong> = peso − masa grasa</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Asimetrías bilaterales</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Cálculo:</strong> Diferencia % = |D − I| / promedio(D, I) × 100. Se alerta si &gt;10%.</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Impellizzeri, F.M. et al. (2007). Is a single-leg squat test reliable for a thorough assessment of muscle function? <em>J Sports Sci</em>, 25(14), 1553–1563.</p>
                  </div>
                </div>
              )}
            </div>
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
                const date = ev.evaluation_date ? new Date(ev.evaluation_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(ev.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
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
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => handleEdit(ev)} className="p-1.5 rounded-lg hover:bg-kore-cream/60 text-kore-gray-dark/40 hover:text-kore-red transition-colors cursor-pointer" title="Editar">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(ev.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-kore-gray-dark/40 hover:text-red-600 transition-colors cursor-pointer" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                      </button>
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

        {/* ══════ DELETE CONFIRMATION MODAL ══════ */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
              <h3 className="font-heading text-lg font-semibold text-kore-gray-dark mb-2">Eliminar evaluación</h3>
              <p className="text-sm text-kore-gray-dark/70 mb-5">¿Estás seguro? Esta acción no se puede deshacer.</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-kore-gray-dark bg-kore-cream hover:bg-kore-gray-light/60 transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button type="button" disabled={submitting} onClick={() => handleDelete(confirmDeleteId)} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 cursor-pointer">
                  {submitting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
