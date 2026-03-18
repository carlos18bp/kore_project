'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  usePhysicalEvaluationStore,
  type PhysicalEvalFormData,
  type PhysicalEvaluation,
} from '@/lib/stores/physicalEvaluationStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

/* ── Color helpers ── */
const COLOR_MAP: Record<string, string> = {
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-amber-100 text-amber-700 border-amber-200',
  red: 'bg-red-100 text-red-600 border-red-200',
};

/* ── Test definitions ── */
type TestDef = {
  key: string;
  label: string;
  unit: string;
  rawField: keyof PhysicalEvalFormData;
  scoreField: keyof PhysicalEvaluation;
  notesField: keyof PhysicalEvalFormData;
  painField?: keyof PhysicalEvalFormData;
  interruptedField?: keyof PhysicalEvalFormData;
  extraFields?: { key: keyof PhysicalEvalFormData; label: string; type: 'number'; max?: number }[];
  description: string;
  reference: string;
};

const TESTS: TestDef[] = [
  {
    key: 'squats',
    label: 'Sentadillas en 1 minuto',
    unit: 'repeticiones',
    rawField: 'squats_reps',
    scoreField: 'squats_score',
    notesField: 'squats_notes',
    painField: 'squats_pain',
    interruptedField: 'squats_interrupted',
    description: 'Mayor cantidad posible de sentadillas correctas en 60 segundos. Mide fuerza-resistencia del tren inferior.',
    reference: 'Rikli & Jones (2001); ACSM (2021)',
  },
  {
    key: 'pushups',
    label: 'Flexiones',
    unit: 'repeticiones',
    rawField: 'pushups_reps',
    scoreField: 'pushups_score',
    notesField: 'pushups_notes',
    painField: 'pushups_pain',
    description: 'Número de flexiones correctas según variante KÓRE. Mide fuerza-resistencia de tren superior.',
    reference: 'CSEP (2003); ACSM (2021)',
  },
  {
    key: 'plank',
    label: 'Plancha abdominal',
    unit: 'segundos',
    rawField: 'plank_seconds',
    scoreField: 'plank_score',
    notesField: 'plank_notes',
    painField: 'plank_pain',
    description: 'Tiempo máximo manteniendo una plancha correcta. Mide resistencia del core y control lumbopélvico.',
    reference: 'McGill (2015); Tong et al. (2014)',
  },
  {
    key: 'walk',
    label: 'Caminata de 6 minutos',
    unit: 'metros',
    rawField: 'walk_meters',
    scoreField: 'walk_score',
    notesField: 'walk_notes',
    extraFields: [
      { key: 'walk_effort_perception', label: 'Percepción de esfuerzo (1–10)', type: 'number', max: 10 },
      { key: 'walk_heart_rate', label: 'Frecuencia cardiaca final (bpm)', type: 'number', max: 250 },
    ],
    description: 'Distancia total recorrida en 6 minutos. Mide capacidad aeróbica funcional.',
    reference: 'ATS (2002); Enright & Sherrill (1998)',
  },
  {
    key: 'unipodal',
    label: 'Apoyo unipodal',
    unit: 'segundos',
    rawField: 'unipodal_seconds',
    scoreField: 'unipodal_score',
    notesField: 'unipodal_notes',
    description: 'Tiempo máximo sobre un solo pie. Mide estabilidad, control neuromuscular y riesgo de caída.',
    reference: 'Springer et al. (2007); Bohannon (2006)',
  },
];

const MOBILITY_ZONES = [
  { key: 'hip_mobility' as const, label: 'Cadera', desc: 'Capacidad de flexión y control sin compensaciones' },
  { key: 'shoulder_mobility' as const, label: 'Hombros', desc: 'Rango funcional del complejo escapulohumeral' },
  { key: 'ankle_mobility' as const, label: 'Tobillo', desc: 'Dorsiflexión funcional para marcha, sentadilla y estabilidad' },
];

/* ── Index card ── */
function IndexCard({ label, value, category, color }: {
  label: string; value: string | number | null; category: string; color: string;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.green;
  return (
    <div className={`rounded-xl border p-4 ${c}`}>
      <p className="text-xs uppercase tracking-wider font-medium opacity-70 mb-1">{label}</p>
      <p className="font-heading text-2xl font-bold">{value ?? '—'}</p>
      <p className="text-xs font-medium mt-1">{category}</p>
    </div>
  );
}

/* ── Alert badge ── */
function AlertBadge({ alerts }: { alerts: string[] }) {
  const [open, setOpen] = useState(false);
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-700 text-xs font-medium cursor-pointer hover:bg-amber-200 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        {alerts.length} alerta{alerts.length > 1 ? 's' : ''}
      </button>
      {open && (
        <div className="absolute z-10 top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-amber-200 p-3 space-y-2">
          {alerts.map((a, i) => (
            <p key={i} className="text-xs text-amber-800 leading-relaxed">{a}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function emptyForm(): PhysicalEvalFormData {
  return {
    evaluation_date: '',
    squats_reps: null, pushups_reps: null, plank_seconds: null,
    walk_meters: null, unipodal_seconds: null,
    hip_mobility: null, shoulder_mobility: null, ankle_mobility: null,
    squats_notes: '', squats_pain: false, squats_interrupted: false,
    pushups_notes: '', pushups_pain: false,
    plank_notes: '', plank_pain: false,
    walk_notes: '', walk_effort_perception: null, walk_heart_rate: null,
    unipodal_notes: '', mobility_notes: '', notes: '',
  };
}

export default function TrainerPhysicalEvalWrapper() {
  return <Suspense><TrainerPhysicalEvalPage /></Suspense>;
}

function TrainerPhysicalEvalPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const clientId = Number(searchParams.get('id'));
  const {
    evaluations, loading, submitting, error,
    fetchEvaluations, createEvaluation, updateEvaluation, deleteEvaluation,
  } = usePhysicalEvaluationStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const [showForm, setShowForm] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [showScience, setShowScience] = useState(false);
  const [editingRecs, setEditingRecs] = useState<Record<string, { result: string; action: string }>>({});
  const [recsSaved, setRecsSaved] = useState(false);
  const [form, setForm] = useState<PhysicalEvalFormData>(emptyForm());
  const [justCreated, setJustCreated] = useState<PhysicalEvaluation | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (clientId) fetchEvaluations(clientId);
  }, [clientId, fetchEvaluations]);

  const toggleSection = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  const setNumField = (field: keyof PhysicalEvalFormData, val: string) => {
    setForm(p => ({ ...p, [field]: val === '' ? null : Number(val) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    const result = editingId
      ? await updateEvaluation(clientId, editingId, form)
      : await createEvaluation(clientId, form);
    if (result) {
      setJustCreated(result);
      setShowForm(false);
      setForm(emptyForm());
      setEditingId(null);
    }
  };

  const handleEdit = (ev: PhysicalEvaluation) => {
    setForm({
      evaluation_date: ev.evaluation_date || '',
      squats_reps: ev.squats_reps, pushups_reps: ev.pushups_reps,
      plank_seconds: ev.plank_seconds, walk_meters: ev.walk_meters,
      unipodal_seconds: ev.unipodal_seconds,
      hip_mobility: ev.hip_mobility, shoulder_mobility: ev.shoulder_mobility,
      ankle_mobility: ev.ankle_mobility,
      squats_notes: ev.squats_notes || '', squats_pain: ev.squats_pain,
      squats_interrupted: ev.squats_interrupted,
      pushups_notes: ev.pushups_notes || '', pushups_pain: ev.pushups_pain,
      plank_notes: ev.plank_notes || '', plank_pain: ev.plank_pain,
      walk_notes: ev.walk_notes || '',
      walk_effort_perception: ev.walk_effort_perception,
      walk_heart_rate: ev.walk_heart_rate,
      unipodal_notes: ev.unipodal_notes || '',
      mobility_notes: ev.mobility_notes || '',
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
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">Evaluación Física</h1>
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
            {/* Date */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">{editingId ? 'Editar evaluación' : 'Fecha de evaluación'}</h2>
              <input
                type="date"
                value={form.evaluation_date}
                onChange={e => setForm(p => ({ ...p, evaluation_date: e.target.value }))}
                className="w-full max-w-xs px-3 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition"
              />
            </div>

            {/* Test sections */}
            {TESTS.map(test => (
              <div key={test.key} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
                <button type="button" onClick={() => toggleSection(test.key)} className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-kore-cream/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="font-heading text-base font-semibold text-kore-gray-dark">{test.label}</span>
                      {(form[test.rawField] as number | null) != null && (
                        <span className="ml-2 text-xs text-kore-red font-medium">{form[test.rawField]} {test.unit}</span>
                      )}
                    </div>
                  </div>
                  <svg className={`w-5 h-5 text-kore-gray-dark/40 transition-transform ${openSections[test.key] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {openSections[test.key] && (
                  <div className="px-5 pb-5 space-y-3">
                    <p className="text-xs text-kore-gray-dark/50">{test.description}</p>
                    <div>
                      <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Resultado ({test.unit})</label>
                      <input
                        type="number"
                        min={0}
                        value={(form[test.rawField] as number | null) ?? ''}
                        onChange={e => setNumField(test.rawField, e.target.value)}
                        className="w-full max-w-xs px-3 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition"
                        placeholder={`0 ${test.unit}`}
                      />
                    </div>
                    {test.extraFields?.map(ef => (
                      <div key={ef.key}>
                        <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">{ef.label}</label>
                        <input
                          type="number"
                          min={0}
                          max={ef.max}
                          value={(form[ef.key] as number | null) ?? ''}
                          onChange={e => setNumField(ef.key, e.target.value)}
                          className="w-full max-w-xs px-3 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition"
                        />
                      </div>
                    ))}
                    {test.painField && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form[test.painField]}
                          onChange={e => setForm(p => ({ ...p, [test.painField!]: e.target.checked }))}
                          className="rounded border-kore-gray-light accent-kore-red"
                        />
                        <span className="text-xs text-kore-gray-dark/60">Reportó dolor</span>
                      </label>
                    )}
                    {test.interruptedField && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form[test.interruptedField]}
                          onChange={e => setForm(p => ({ ...p, [test.interruptedField!]: e.target.checked }))}
                          className="rounded border-kore-gray-light accent-kore-red"
                        />
                        <span className="text-xs text-kore-gray-dark/60">Se interrumpió</span>
                      </label>
                    )}
                    <div>
                      <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Observaciones</label>
                      <textarea
                        value={(form[test.notesField] as string) || ''}
                        onChange={e => setForm(p => ({ ...p, [test.notesField]: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none"
                        placeholder="Observaciones técnicas..."
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Mobility section */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
              <button type="button" onClick={() => toggleSection('mobility')} className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-kore-cream/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  </div>
                  <span className="font-heading text-base font-semibold text-kore-gray-dark">Movilidad</span>
                </div>
                <svg className={`w-5 h-5 text-kore-gray-dark/40 transition-transform ${openSections.mobility ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {openSections.mobility && (
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-xs text-kore-gray-dark/50">Puntúa cada zona de 1 (muy limitada) a 5 (excelente).</p>
                  {MOBILITY_ZONES.map(zone => (
                    <div key={zone.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-sm font-medium text-kore-gray-dark">{zone.label}</span>
                          <p className="text-xs text-kore-gray-dark/40">{zone.desc}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setForm(p => ({ ...p, [zone.key]: (p[zone.key] as number | null) === v ? null : v }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                              (form[zone.key] as number | null) === v
                                ? v <= 2 ? 'bg-red-100 border-red-300 text-red-600'
                                  : v === 3 ? 'bg-amber-100 border-amber-300 text-amber-700'
                                    : 'bg-green-100 border-green-300 text-green-700'
                                : 'bg-white/50 border-kore-gray-light/50 text-kore-gray-dark/50 hover:bg-kore-cream/40'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Observaciones de movilidad</label>
                    <textarea
                      value={form.mobility_notes}
                      onChange={e => setForm(p => ({ ...p, mobility_notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none"
                      placeholder="Observaciones sobre movilidad..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes + Submit */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Notas generales</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none mb-4"
                placeholder="Notas adicionales..."
              />
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
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Última evaluación</h2>
              <span className="text-xs text-kore-gray-dark/40">
                {latest.evaluation_date
                  ? new Date(latest.evaluation_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                  : new Date(latest.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                {latest.age_at_evaluation && <span className="ml-2">({latest.age_at_evaluation} años, {latest.sex_at_evaluation})</span>}
              </span>
            </div>

            {/* Index cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <IndexCard label="General" value={latest.general_index} category={latest.general_category} color={latest.general_color} />
              <IndexCard label="Fuerza" value={latest.strength_index} category={latest.strength_category} color={latest.strength_color} />
              <IndexCard label="Resistencia" value={latest.endurance_index} category={latest.endurance_category} color={latest.endurance_color} />
              <IndexCard label="Movilidad" value={latest.mobility_index} category={latest.mobility_category} color={latest.mobility_color} />
              <IndexCard label="Equilibrio" value={latest.balance_index} category={latest.balance_category} color={latest.balance_color} />
            </div>

            {/* Individual scores + Cross-module alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-4">Puntajes individuales</p>
                <div className="space-y-3">
                  {TESTS.map(test => {
                    const score = latest[test.scoreField] as number | null;
                    const raw = latest[test.rawField as keyof PhysicalEvaluation] as number | null;
                    const alerts = latest.cross_module_alerts?.[test.key] || [];
                    const pct = score ? (score / 5) * 100 : 0;
                    const barColor = !score ? 'bg-gray-300' : score <= 2 ? 'bg-red-400' : score <= 3 ? 'bg-amber-400' : 'bg-green-500';
                    return (
                      <div key={test.key}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-kore-gray-dark/80 font-medium">{test.label}</span>
                            <AlertBadge alerts={alerts} />
                          </div>
                          <span className="text-xs text-kore-gray-dark/50">
                            {raw != null ? `${raw} ${test.unit}` : '—'} → {score ?? '—'}/5
                          </span>
                        </div>
                        <div className="h-2 bg-kore-gray-light/30 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {/* Mobility */}
                  <div className="pt-2 border-t border-kore-gray-light/20">
                    <p className="text-xs text-kore-gray-dark/50 font-medium mb-2">Movilidad</p>
                    {MOBILITY_ZONES.map(zone => {
                      const val = latest[zone.key as keyof PhysicalEvaluation] as number | null;
                      const pct = val ? (val / 5) * 100 : 0;
                      const barColor = !val ? 'bg-gray-300' : val <= 2 ? 'bg-red-400' : val === 3 ? 'bg-amber-400' : 'bg-green-500';
                      return (
                        <div key={zone.key} className="mb-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-kore-gray-dark/70">{zone.label}</span>
                            <span className="text-xs text-kore-gray-dark/50">{val ?? '—'}/5</span>
                          </div>
                          <div className="h-1.5 bg-kore-gray-light/30 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {/* Pain / interruption flags */}
                {(latest.squats_pain || latest.pushups_pain || latest.plank_pain || latest.squats_interrupted) && (
                  <div className="bg-red-50 rounded-2xl p-5 border border-red-200 shadow-sm">
                    <p className="text-xs text-red-600 uppercase tracking-wider font-medium mb-2">Señales de alerta</p>
                    {latest.squats_pain && <p className="text-xs text-red-700">Dolor reportado en sentadillas</p>}
                    {latest.squats_interrupted && <p className="text-xs text-red-700">Sentadillas interrumpidas</p>}
                    {latest.pushups_pain && <p className="text-xs text-red-700">Dolor reportado en flexiones</p>}
                    {latest.plank_pain && <p className="text-xs text-red-700">Dolor reportado en plancha</p>}
                  </div>
                )}

                {/* Notes */}
                {latest.notes && (
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                    <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1">Observaciones</p>
                    <p className="text-sm text-kore-gray-dark/70">{latest.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ══ RECOMMENDATIONS ══ */}
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
                  <p className="text-xs text-kore-gray-dark/50">Estas recomendaciones se mostrarán al cliente. Puedes editarlas.</p>
                  {Object.entries(editingRecs).map(([key, rec]) => {
                    const labels: Record<string, string> = { general: 'General', strength: 'Fuerza', endurance: 'Resistencia', mobility: 'Movilidad', balance: 'Equilibrio' };
                    return (
                      <div key={key} className="bg-kore-cream/30 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-kore-gray-dark/60 uppercase tracking-wider font-medium">{labels[key] || key}</p>
                        <div>
                          <label className="text-xs text-kore-gray-dark/50 mb-0.5 block">Resultado</label>
                          <textarea value={rec.result} onChange={e => setEditingRecs(p => ({ ...p, [key]: { ...p[key], result: e.target.value } }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-kore-gray-light/50 bg-white/70 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none" />
                        </div>
                        <div>
                          <label className="text-xs text-kore-gray-dark/50 mb-0.5 block">Acción recomendada</label>
                          <textarea value={rec.action} onChange={e => setEditingRecs(p => ({ ...p, [key]: { ...p[key], action: e.target.value } }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-kore-gray-light/50 bg-white/70 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none" />
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
                <div className="px-5 pb-5 space-y-3">
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Baremos ajustados por edad y sexo</p>
                    <p className="text-xs text-kore-gray-dark/70">Cada test usa tablas de referencia diferenciadas por sexo y 4 franjas etarias (18–35, 36–50, 51–65, 66+), basadas en la literatura científica.</p>
                  </div>
                  {TESTS.map(t => (
                    <div key={t.key} className="bg-kore-cream/30 rounded-xl p-4">
                      <p className="text-sm font-semibold text-kore-gray-dark mb-0.5">{t.label}</p>
                      <p className="text-xs text-kore-gray-dark/70 mb-1">{t.description}</p>
                      <p className="text-xs text-kore-gray-dark/50 italic">{t.reference}</p>
                    </div>
                  ))}
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-0.5">Movilidad</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1">Evaluación funcional de rangos articulares clave (cadera, hombros, tobillo).</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Kendall et al. (2005); Cook (2010), Movement: FMS.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Índices compuestos</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Fuerza</strong> = promedio(sentadillas, flexiones, plancha). <strong>Resistencia</strong> = caminata. <strong>Movilidad</strong> = promedio(cadera, hombros, tobillo). <strong>Equilibrio</strong> = apoyo unipodal.</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>General</strong> = promedio(fuerza, resistencia, movilidad, equilibrio).</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Basado en fitness profiling multidimensional. Heyward & Gibson (2014); ACSM (2021).</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Clasificación</p>
                    <p className="text-xs text-kore-gray-dark/70">1.0–1.9 Muy bajo (rojo) · 2.0–2.9 Bajo (amarillo) · 3.0–3.9 Intermedio (verde) · 4.0–4.5 Bueno (verde) · 4.6–5.0 Muy bueno (verde)</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Integración cruzada</p>
                    <p className="text-xs text-kore-gray-dark/70">Las alertas contextuales se generan automáticamente a partir de la última evaluación de antropometría y posturometría del cliente.</p>
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-kore-gray-dark">{date}{i === 0 && <span className="text-xs text-kore-red ml-2">Más reciente</span>}</p>
                      <p className="text-xs text-kore-gray-dark/50">General {ev.general_index} ({ev.general_category}) · Fza {ev.strength_index} · Res {ev.endurance_index} · Mov {ev.mobility_index} · Eq {ev.balance_index}</p>
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
        ) : null}

        {/* ══════ DELETE MODAL ══════ */}
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
