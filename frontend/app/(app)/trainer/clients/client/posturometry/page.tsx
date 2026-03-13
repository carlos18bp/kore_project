'use client';

import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  usePosturometryStore,
  type PosturometryFormData,
  type PosturometryEvaluation,
  type ViewData,
  type SegmentEntry,
} from '@/lib/stores/posturometryStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

/* ── Color helpers ── */
const COLOR_MAP: Record<string, string> = {
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-amber-100 text-amber-700 border-amber-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  red: 'bg-red-100 text-red-600 border-red-200',
};

/* ── Segment definitions per view ── */

type SubFieldDef = {
  key: string;
  label: string;
  type: 'severity' | 'checkbox';
};

type SegmentDef = {
  key: string;
  label: string;
  subFields: SubFieldDef[];
};

const ANTERIOR_SEGMENTS: SegmentDef[] = [
  {
    key: 'cabeza', label: 'Cabeza',
    subFields: [
      { key: 'inclinacion', label: 'Inclinación', type: 'severity' },
      { key: 'rotacion', label: 'Rotación', type: 'severity' },
    ],
  },
  {
    key: 'cuello', label: 'Cuello',
    subFields: [
      { key: 'masa_muscular', label: 'Masa Muscular', type: 'checkbox' },
    ],
  },
  {
    key: 'hombros', label: 'Hombros',
    subFields: [
      { key: 'ascendido_derecho', label: 'Ascendido Derecho', type: 'severity' },
      { key: 'ascendido_izquierdo', label: 'Ascendido Izquierdo', type: 'severity' },
    ],
  },
  {
    key: 'claviculas', label: 'Clavículas',
    subFields: [
      { key: 'ascendido_derecho', label: 'Ascendido Derecho', type: 'severity' },
      { key: 'ascendido_izquierdo', label: 'Ascendido Izquierdo', type: 'severity' },
    ],
  },
  {
    key: 'altura_tetillas', label: 'Altura Tetillas',
    subFields: [
      { key: 'ascendido_derecho', label: 'Ascendido Derecho', type: 'severity' },
      { key: 'ascendido_izquierdo', label: 'Ascendido Izquierdo', type: 'severity' },
    ],
  },
  {
    key: 'pliegue_inguinal', label: 'Pliegue Inguinal',
    subFields: [],
  },
  {
    key: 'rodillas', label: 'Rodillas',
    subFields: [
      { key: 'geno_varo', label: 'Geno Varo', type: 'checkbox' },
      { key: 'evertido_valgo', label: 'Evertido Valgo', type: 'checkbox' },
    ],
  },
  {
    key: 'pie', label: 'Pie',
    subFields: [
      { key: 'abduccion', label: 'Abducción', type: 'checkbox' },
      { key: 'aduccion', label: 'Aducción', type: 'checkbox' },
      { key: 'eversion', label: 'Eversión', type: 'checkbox' },
      { key: 'inversion', label: 'Inversión', type: 'checkbox' },
    ],
  },
];

const LATERAL_SEGMENTS: SegmentDef[] = [
  {
    key: 'cabeza', label: 'Cabeza',
    subFields: [
      { key: 'protraccion', label: 'Protracción', type: 'severity' },
      { key: 'retraccion', label: 'Retracción', type: 'severity' },
    ],
  },
  {
    key: 'escapulas', label: 'Escápulas',
    subFields: [
      { key: 'protuidas', label: 'Protuidas', type: 'severity' },
      { key: 'retraidas', label: 'Retraidas', type: 'severity' },
    ],
  },
  {
    key: 'columna_vertebral', label: 'Columna Vertebral',
    subFields: [
      { key: 'lordosis', label: 'Lordosis', type: 'severity' },
      { key: 'cifosis', label: 'Cifosis', type: 'severity' },
    ],
  },
  {
    key: 'codos_angulo', label: 'Codos Ángulo',
    subFields: [],
  },
  {
    key: 'abdomen_prominente', label: 'Abdomen Prominente',
    subFields: [],
  },
  {
    key: 'cadera', label: 'Cadera',
    subFields: [
      { key: 'anteversion', label: 'Anteversión', type: 'severity' },
      { key: 'retroversion', label: 'Retroversión', type: 'severity' },
    ],
  },
  {
    key: 'rodillas', label: 'Rodillas',
    subFields: [
      { key: 'hiperextension', label: 'Hiperextensión', type: 'severity' },
      { key: 'semiflexion', label: 'Semiflexión', type: 'severity' },
    ],
  },
  {
    key: 'pies', label: 'Pies',
    subFields: [
      { key: 'plano', label: 'Plano', type: 'severity' },
    ],
  },
];

const POSTERIOR_SEGMENTS: SegmentDef[] = [
  {
    key: 'cabeza', label: 'Cabeza',
    subFields: [
      { key: 'inclinacion', label: 'Inclinación', type: 'severity' },
      { key: 'rotacion', label: 'Rotación', type: 'severity' },
    ],
  },
  {
    key: 'hombros', label: 'Hombros',
    subFields: [
      { key: 'ascendido_derecho', label: 'Ascendido Derecho', type: 'severity' },
      { key: 'ascendido_izquierdo', label: 'Ascendido Izquierdo', type: 'severity' },
    ],
  },
  {
    key: 'escapulas', label: 'Escápulas',
    subFields: [
      { key: 'ascendida_derecho', label: 'Ascendida Derecho', type: 'severity' },
      { key: 'ascendida_izquierdo', label: 'Ascendida Izquierdo', type: 'severity' },
    ],
  },
  {
    key: 'codos_flexionados', label: 'Codos Flexionados',
    subFields: [
      { key: 'ascendido_derecho', label: 'Ascendido Derecho', type: 'severity' },
      { key: 'ascendido_izquierdo', label: 'Ascendido Izquierdo', type: 'severity' },
    ],
  },
  {
    key: 'espacios_brazo_tronco', label: 'Espacios Brazo-Tronco',
    subFields: [],
  },
  {
    key: 'columna_vertebral', label: 'Columna Vertebral',
    subFields: [
      { key: 'alineacion_apofisis', label: 'Alineación apófisis espinosas convexidad', type: 'severity' },
    ],
  },
  {
    key: 'pliegues_laterales', label: 'Pliegues Laterales',
    subFields: [],
  },
  {
    key: 'altura_cresta_inguinales', label: 'Altura Cresta Inguinales',
    subFields: [],
  },
  {
    key: 'gluteos', label: 'Glúteos',
    subFields: [
      { key: 'tamano', label: 'Tamaño', type: 'checkbox' },
      { key: 'pliegues', label: 'Pliegues', type: 'checkbox' },
    ],
  },
  {
    key: 'pliegues_popliteos', label: 'Pliegues Poplíteos',
    subFields: [
      { key: 'pierna_derecha', label: 'Pierna Derecha', type: 'checkbox' },
      { key: 'pierna_izquierda', label: 'Pierna Izquierda', type: 'checkbox' },
    ],
  },
  {
    key: 'rodillas', label: 'Rodillas',
    subFields: [
      { key: 'geno_varo', label: 'Geno Varo', type: 'checkbox' },
      { key: 'evertido_valgo', label: 'Evertido Valgo', type: 'checkbox' },
    ],
  },
  {
    key: 'pies', label: 'Pies',
    subFields: [
      { key: 'abduccion', label: 'Abducción', type: 'checkbox' },
      { key: 'aduccion', label: 'Aducción', type: 'checkbox' },
      { key: 'eversion', label: 'Eversión', type: 'checkbox' },
      { key: 'inversion', label: 'Inversión', type: 'checkbox' },
    ],
  },
];

/* ── Severity select component ── */
function SeveritySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const base = 'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border';
  return (
    <div className="flex gap-1.5">
      {(['L', 'M', 'S'] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(value === s ? '' : s)}
          className={`${base} ${value === s
            ? s === 'L' ? 'bg-amber-100 border-amber-300 text-amber-700'
              : s === 'M' ? 'bg-orange-100 border-orange-300 text-orange-700'
                : 'bg-red-100 border-red-300 text-red-600'
            : 'bg-white/50 border-kore-gray-light/50 text-kore-gray-dark/50 hover:bg-kore-cream/40'
          }`}
        >
          {s === 'L' ? 'Leve' : s === 'M' ? 'Moderado' : 'Severo'}
        </button>
      ))}
    </div>
  );
}

/* ── Segment row component ── */
function SegmentRow({
  def, entry, onToggleNormal, onSeverityChange, onSubFieldChange,
}: {
  def: SegmentDef;
  entry: SegmentEntry;
  onToggleNormal: () => void;
  onSeverityChange: (severity: number) => void;
  onSubFieldChange: (subKey: string, value: string | boolean) => void;
}) {
  const isNormal = entry.is_normal;
  return (
    <div className="border-b border-kore-gray-light/20 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-kore-gray-dark min-w-[140px]">{def.label}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { if (!isNormal) { onToggleNormal(); } }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${isNormal ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white/50 border-kore-gray-light/50 text-kore-gray-dark/40 hover:bg-green-50'}`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => { if (isNormal) { onToggleNormal(); onSeverityChange(1); } }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${!isNormal ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white/50 border-kore-gray-light/50 text-kore-gray-dark/40 hover:bg-red-50'}`}
          >
            Alterado
          </button>
        </div>
      </div>
      {!isNormal && (
        <div className="mt-3 ml-4 space-y-2">
          {def.subFields.length === 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-kore-gray-dark/50">Severidad:</span>
              <SeveritySelect
                value={entry.severity === 1 ? 'L' : entry.severity === 2 ? 'M' : entry.severity === 3 ? 'S' : ''}
                onChange={(v) => onSeverityChange(v === 'L' ? 1 : v === 'M' ? 2 : v === 'S' ? 3 : 0)}
              />
            </div>
          )}
          {def.subFields.map((sf) => (
            <div key={sf.key} className="flex items-center gap-3">
              <span className="text-xs text-kore-gray-dark/60 min-w-[120px]">{sf.label}</span>
              {sf.type === 'severity' ? (
                <SeveritySelect
                  value={(entry.sub_fields[sf.key] as string) || ''}
                  onChange={(v) => {
                    onSubFieldChange(sf.key, v);
                    const allSubs = { ...entry.sub_fields, [sf.key]: v };
                    const sevValues = Object.values(allSubs).filter((sv) => typeof sv === 'string' && sv).map((sv) => sv === 'L' ? 1 : sv === 'M' ? 2 : sv === 'S' ? 3 : 0);
                    const maxSev = sevValues.length > 0 ? Math.max(...sevValues) : 1;
                    onSeverityChange(maxSev);
                  }}
                />
              ) : (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!entry.sub_fields[sf.key]}
                    onChange={(e) => {
                      onSubFieldChange(sf.key, e.target.checked);
                      if (e.target.checked && entry.severity < 1) onSeverityChange(1);
                    }}
                    className="rounded border-kore-gray-light accent-kore-red"
                  />
                  <span className="text-xs text-kore-gray-dark/50">Sí</span>
                </label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── View form section component ── */
function ViewSection({
  title, icon, segments, viewData, onViewDataChange, observations, onObservationsChange, photo, onPhotoChange,
}: {
  title: string;
  icon: React.ReactNode;
  segments: SegmentDef[];
  viewData: ViewData;
  onViewDataChange: (data: ViewData) => void;
  observations: string;
  onObservationsChange: (v: string) => void;
  photo: File | null;
  onPhotoChange: (f: File | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const getEntry = (segKey: string): SegmentEntry => {
    return viewData[segKey] || { is_normal: true, severity: 0, sub_fields: {} };
  };

  const updateEntry = (segKey: string, updates: Partial<SegmentEntry>) => {
    const current = getEntry(segKey);
    onViewDataChange({ ...viewData, [segKey]: { ...current, ...updates } });
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-kore-cream/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center">
            {icon}
          </div>
          <span className="font-heading text-base font-semibold text-kore-gray-dark">{title}</span>
          {Object.values(viewData).some((e) => !e.is_normal) && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {Object.values(viewData).filter((e) => !e.is_normal).length} alteraciones
            </span>
          )}
        </div>
        <svg className={`w-5 h-5 text-kore-gray-dark/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <div className="space-y-0">
            {segments.map((def) => (
              <SegmentRow
                key={def.key}
                def={def}
                entry={getEntry(def.key)}
                onToggleNormal={() => {
                  const current = getEntry(def.key);
                  updateEntry(def.key, {
                    is_normal: !current.is_normal,
                    severity: current.is_normal ? 1 : 0,
                    sub_fields: current.is_normal ? current.sub_fields : {},
                  });
                }}
                onSeverityChange={(severity) => updateEntry(def.key, { severity })}
                onSubFieldChange={(subKey, value) => {
                  const current = getEntry(def.key);
                  updateEntry(def.key, { sub_fields: { ...current.sub_fields, [subKey]: value } });
                }}
              />
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPhotoChange(e.target.files?.[0] || null)}
                className="text-sm text-kore-gray-dark file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-kore-gray-light/50 file:text-xs file:bg-kore-cream file:text-kore-gray-dark file:cursor-pointer"
              />
              {photo && <p className="text-xs text-green-600 mt-1">{photo.name}</p>}
            </div>
            <div>
              <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Observaciones</label>
              <textarea
                value={observations}
                onChange={(e) => onObservationsChange(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none"
                placeholder="Observaciones de esta vista..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Index card component ── */
function IndexCard({ label, value, category, color }: {
  label: string; value: string | number; category: string; color: string;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.green;
  return (
    <div className={`rounded-xl border p-4 ${c}`}>
      <p className="text-xs uppercase tracking-wider font-medium opacity-70 mb-1">{label}</p>
      <p className="font-heading text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1">{category}</p>
    </div>
  );
}

/* ── Region label ── */
const REGION_LABELS: Record<string, string> = {
  upper: 'Superior', central: 'Central', lower: 'Inferior',
};

/* ── Emoji-free view icon ── */
function ViewIcon() {
  return (
    <svg className="w-4 h-4 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function emptyFormData(): PosturometryFormData {
  return {
    evaluation_date: '',
    anterior_data: {},
    lateral_right_data: {},
    lateral_left_data: {},
    posterior_data: {},
    anterior_observations: '',
    lateral_right_observations: '',
    lateral_left_observations: '',
    posterior_observations: '',
    notes: '',
    anterior_photo: null,
    lateral_right_photo: null,
    lateral_left_photo: null,
    posterior_photo: null,
  };
}

export default function TrainerPosturometryWrapper() {
  return <Suspense><TrainerPosturometryPage /></Suspense>;
}

function TrainerPosturometryPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const clientId = Number(searchParams.get('id'));
  const { evaluations, loading, submitting, error, fetchEvaluations, createEvaluation, updateEvaluation } = usePosturometryStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const [showForm, setShowForm] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [showScience, setShowScience] = useState(false);
  const [editingRecs, setEditingRecs] = useState<Record<string, { result: string; action: string }>>({});
  const [recsSaved, setRecsSaved] = useState(false);
  const [form, setForm] = useState<PosturometryFormData>(emptyFormData());
  const [justCreated, setJustCreated] = useState<PosturometryEvaluation | null>(null);

  useEffect(() => {
    if (clientId) fetchEvaluations(clientId);
  }, [clientId, fetchEvaluations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    const result = await createEvaluation(clientId, form);
    if (result) {
      setJustCreated(result);
      setShowForm(false);
      setForm(emptyFormData());
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
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">Posturometría</h1>
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
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Fecha de evaluación</h2>
              <input
                type="date"
                value={form.evaluation_date}
                onChange={(e) => setForm((prev) => ({ ...prev, evaluation_date: e.target.value }))}
                className="w-full max-w-xs px-3 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition"
              />
            </div>

            <ViewSection
              title="Vista Anterior"
              icon={<ViewIcon />}
              segments={ANTERIOR_SEGMENTS}
              viewData={form.anterior_data}
              onViewDataChange={(data) => setForm((prev) => ({ ...prev, anterior_data: data }))}
              observations={form.anterior_observations}
              onObservationsChange={(v) => setForm((prev) => ({ ...prev, anterior_observations: v }))}
              photo={form.anterior_photo}
              onPhotoChange={(f) => setForm((prev) => ({ ...prev, anterior_photo: f }))}
            />

            <ViewSection
              title="Vista Lateral Derecha"
              icon={<ViewIcon />}
              segments={LATERAL_SEGMENTS}
              viewData={form.lateral_right_data}
              onViewDataChange={(data) => setForm((prev) => ({ ...prev, lateral_right_data: data }))}
              observations={form.lateral_right_observations}
              onObservationsChange={(v) => setForm((prev) => ({ ...prev, lateral_right_observations: v }))}
              photo={form.lateral_right_photo}
              onPhotoChange={(f) => setForm((prev) => ({ ...prev, lateral_right_photo: f }))}
            />

            <ViewSection
              title="Vista Lateral Izquierda"
              icon={<ViewIcon />}
              segments={LATERAL_SEGMENTS}
              viewData={form.lateral_left_data}
              onViewDataChange={(data) => setForm((prev) => ({ ...prev, lateral_left_data: data }))}
              observations={form.lateral_left_observations}
              onObservationsChange={(v) => setForm((prev) => ({ ...prev, lateral_left_observations: v }))}
              photo={form.lateral_left_photo}
              onPhotoChange={(f) => setForm((prev) => ({ ...prev, lateral_left_photo: f }))}
            />

            <ViewSection
              title="Vista Posterior"
              icon={<ViewIcon />}
              segments={POSTERIOR_SEGMENTS}
              viewData={form.posterior_data}
              onViewDataChange={(data) => setForm((prev) => ({ ...prev, posterior_data: data }))}
              observations={form.posterior_observations}
              onObservationsChange={(v) => setForm((prev) => ({ ...prev, posterior_observations: v }))}
              photo={form.posterior_photo}
              onPhotoChange={(f) => setForm((prev) => ({ ...prev, posterior_photo: f }))}
            />

            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <label className="block text-xs text-kore-gray-dark/60 uppercase tracking-wider mb-1">Notas generales</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-kore-gray-light/50 bg-white/50 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20 transition resize-none mb-4"
                placeholder="Notas adicionales..."
              />
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
          <div className="space-y-6 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Última evaluación</h2>
              <span className="text-xs text-kore-gray-dark/40">
                {latest.evaluation_date
                  ? new Date(latest.evaluation_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                  : new Date(latest.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            {/* Index cards — full width */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <IndexCard label="Índice Global" value={latest.global_index} category={latest.global_category} color={latest.global_color} />
              <IndexCard label="Superior" value={latest.upper_index} category={latest.upper_category} color={latest.upper_color} />
              <IndexCard label="Central" value={latest.central_index} category={latest.central_category} color={latest.central_color} />
              <IndexCard label="Inferior" value={latest.lower_index} category={latest.lower_category} color={latest.lower_color} />
            </div>

            {/* 2-column layout: Left = Segment scores | Right = Findings + Photos + Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column — Segment scores */}
              {latest.segment_scores && Object.keys(latest.segment_scores).length > 0 && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                  <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-4">Puntaje por segmento</p>
                  <div className="space-y-4">
                    {(['upper', 'central', 'lower'] as const).map((region) => (
                      <div key={region}>
                        <p className="text-xs font-semibold text-kore-gray-dark/60 mb-1.5">{REGION_LABELS[region]}</p>
                        {Object.entries(latest.segment_scores)
                          .filter(([, s]) => s.region === region)
                          .map(([key, s]) => (
                            <div key={key} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-kore-cream/30">
                              <span className="text-xs text-kore-gray-dark/70">{s.label}</span>
                              <span className={`text-xs font-bold ${s.score === 0 ? 'text-green-600' : s.score <= 1 ? 'text-amber-600' : s.score <= 2 ? 'text-orange-600' : 'text-red-600'}`}>
                                {s.score}
                              </span>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Right column — Findings + Photos + Notes */}
              <div className="space-y-5">
                {/* Findings */}
                {latest.findings && Object.values(latest.findings).some((f) => f.length > 0) && (
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                    <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-3">Hallazgos</p>
                    {Object.entries(latest.findings).map(([view, items]) => (
                      items.length > 0 && (
                        <div key={view} className="mb-3 last:mb-0">
                          <p className="text-xs font-semibold text-kore-gray-dark/60 mb-1 capitalize">{view.replace(/_/g, ' ')}</p>
                          <div className="space-y-1">
                            {items.map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-kore-gray-dark/70 bg-kore-cream/30 rounded-lg px-3 py-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* Photos */}
                {(latest.anterior_photo || latest.lateral_right_photo || latest.lateral_left_photo || latest.posterior_photo) && (
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                    <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-3">Fotos</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { url: latest.anterior_photo, label: 'Anterior' },
                        { url: latest.lateral_right_photo, label: 'Lat. Derecha' },
                        { url: latest.lateral_left_photo, label: 'Lat. Izquierda' },
                        { url: latest.posterior_photo, label: 'Posterior' },
                      ].map((p) => p.url && (
                        <div key={p.label} className="text-center">
                          <img src={p.url} alt={p.label} className="rounded-xl w-full h-36 object-cover border border-kore-gray-light/30" />
                          <p className="text-xs text-kore-gray-dark/50 mt-1">{p.label}</p>
                        </div>
                      ))}
                    </div>
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
                  <p className="text-xs text-kore-gray-dark/50">Estas recomendaciones se mostrarán al cliente. Puedes editarlas.</p>
                  {Object.entries(editingRecs).map(([key, rec]) => {
                    const labels: Record<string, string> = { global: 'Global', upper: 'Zona Superior', central: 'Zona Central', lower: 'Zona Inferior' };
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
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Escala de puntuación</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>0</strong> = Normal (sin alteración) · <strong>1</strong> = Leve · <strong>2</strong> = Moderado · <strong>3</strong> = Severo</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Índice global</strong> = promedio de los puntajes consolidados de los 19 segmentos evaluados</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Adaptado de REEDCO Posture Score (1974) — escala segmentaria donde todos los segmentos contribuyen equitativamente al total.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Clasificación postural</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>0.00–0.50</strong> Postura funcional (verde) · <strong>0.51–1.20</strong> Desbalance leve (amarillo)</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>1.21–2.00</strong> Desbalance moderado (naranja) · <strong>&gt;2.00</strong> Desbalance importante (rojo)</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Índices regionales</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Superior:</strong> cabeza, cuello, hombros, clavículas, tetillas, escápulas, codos</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Central:</strong> columna vertebral, abdomen, cadera, pliegue inguinal, glúteos</p>
                    <p className="text-xs text-kore-gray-dark/70 mb-1"><strong>Inferior:</strong> rodillas, pies, pliegues poplíteos</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Agrupación basada en síndromes cruzados de Janda (1996) — superior, medio e inferior.</p>
                  </div>
                  <div className="bg-kore-cream/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-kore-gray-dark mb-1">Referencias</p>
                    <p className="text-xs text-kore-gray-dark/50 italic mb-1">Kendall, F.P. et al. (2005). <em>Muscles: Testing and Function with Posture and Pain</em>. 5th ed.</p>
                    <p className="text-xs text-kore-gray-dark/50 italic mb-1">REEDCO (1974). Posture Score Sheet. Inter-rater reliability α=0.899–0.915.</p>
                    <p className="text-xs text-kore-gray-dark/50 italic mb-1">New York State Education Dept. (1958). New York Posture Rating Chart. 13 segmentos.</p>
                    <p className="text-xs text-kore-gray-dark/50 italic mb-1">Ferreira et al. (2010). PAS/SAPO: Validation and Reliability. <em>Clinics</em>, 65(7).</p>
                    <p className="text-xs text-kore-gray-dark/50 italic mb-1">Magee, D.J. (2014). <em>Orthopedic Physical Assessment</em>. 6th ed.</p>
                    <p className="text-xs text-kore-gray-dark/50 italic">Janda, V. (1996). Upper/lower crossed syndromes.</p>
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-kore-gray-dark">{date}{i === 0 && <span className="text-xs text-kore-red ml-2">Más reciente</span>}</p>
                      <p className="text-xs text-kore-gray-dark/50">Global {ev.global_index} ({ev.global_category}) · Sup. {ev.upper_index} · Cent. {ev.central_index} · Inf. {ev.lower_index}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
