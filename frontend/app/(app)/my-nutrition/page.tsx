'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Camera, Check, X, Plus, Minus } from 'lucide-react';
import { useNutritionStore, type NutritionFormData, type NutritionHabit } from '@/lib/stores/nutritionStore';
import { useNutritionDailyStore, type MealEntry } from '@/lib/stores/nutritionDailyStore';
import { compressImage } from '@/lib/utils/compressImage';

// ─── Macro ratios by program goal ─────────────────────────────────────────────
// [protein%, carbs%, fat%] — used to estimate daily macro targets from kcal
const MACRO_RATIOS: Record<string, [number, number, number]> = {
  fat_loss:       [0.35, 0.35, 0.30],
  muscle_gain:    [0.25, 0.50, 0.25],
  general_health: [0.30, 0.40, 0.30],
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_LABEL: Record<string, string> = {
  desayuno: 'Desayuno',
  media_manana: 'Media mañana',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
};

// Converts TACO format "Leche, de vaca, integral" → "Leche de vaca integral"
function formatFoodName(name: string): string {
  return name.replace(/,\s*/g, ' ').trim();
}

const BLOCK_TIME: Record<string, string> = {
  desayuno: '7:30',
  media_manana: '10:30',
  almuerzo: '1:00',
  merienda: '4:30',
  cena: '7:30',
};

// ─── Orb CSS animations ───────────────────────────────────────────────────────

const ORB_STYLES = `
  @keyframes kore-orb-1{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(40px,-30px) scale(1.15);}}
  @keyframes kore-orb-2{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(-50px,40px) scale(0.9);}}
  @keyframes kore-orb-3{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(30px,30px) scale(1.1);}}
  @keyframes kore-aurora{0%,100%{opacity:0.45;}50%{opacity:0.85;}}
  @keyframes water-wave{0%,100%{transform:translate(0,0);}50%{transform:translate(-15px,-10px);}}
`;

// ─── Habit analysis ───────────────────────────────────────────────────────────

type HabitItem = { label: string; detail: string };

function analyzeHabits(entry: NutritionHabit): { strengths: HabitItem[]; improvements: HabitItem[] } {
  const strengths: HabitItem[] = [];
  const improvements: HabitItem[] = [];

  const meals = entry.meals_per_day;
  if (meals >= 3 && meals <= 5) strengths.push({ label: 'Comidas al día', detail: `${meals} comidas — frecuencia adecuada` });
  else improvements.push({ label: 'Comidas al día', detail: meals < 3 ? 'Pocas comidas. Distribuye mejor.' : 'Muchas comidas. Revisa.' });

  const water = parseFloat(entry.water_liters);
  if (water >= 2) strengths.push({ label: 'Hidratación', detail: `${water}L al día — buena hidratación` });
  else improvements.push({ label: 'Agua', detail: `${water}L — intenta llegar a 2L` });

  if (entry.fruit_weekly >= 7) strengths.push({ label: 'Frutas', detail: `${entry.fruit_weekly} veces/sem.` });
  else improvements.push({ label: 'Frutas', detail: `${entry.fruit_weekly} veces/sem. — consume diario` });

  if (entry.vegetable_weekly >= 7) strengths.push({ label: 'Verduras', detail: `${entry.vegetable_weekly} veces/sem.` });
  else improvements.push({ label: 'Verduras', detail: `${entry.vegetable_weekly} veces/sem. — incluye a diario` });

  if (entry.protein_frequency >= 4) strengths.push({ label: 'Proteína', detail: 'Consumo frecuente de proteína' });
  else improvements.push({ label: 'Proteína', detail: 'Aumenta la proteína en cada comida' });

  if (entry.ultraprocessed_weekly <= 3) strengths.push({ label: 'Ultraprocesados', detail: `${entry.ultraprocessed_weekly} veces/sem. — bajo` });
  else improvements.push({ label: 'Ultraprocesados', detail: `${entry.ultraprocessed_weekly} veces/sem. — reducir` });

  if (entry.sugary_drinks_weekly <= 2) strengths.push({ label: 'Bebidas az.', detail: `${entry.sugary_drinks_weekly} veces/sem. — controlado` });
  else improvements.push({ label: 'Bebidas az.', detail: `${entry.sugary_drinks_weekly} veces/sem. — reducir` });

  if (entry.eats_breakfast) strengths.push({ label: 'Desayuno', detail: 'Desayunas regularmente — buen hábito' });
  else improvements.push({ label: 'Desayuno', detail: 'Empieza a desayunar con regularidad' });

  return { strengths, improvements };
}

// ─── Habit metrics (aligned with backend nutrition_calculator.py thresholds) ──

type HabitMetricDef = {
  key: string;
  label: string;
  ideal: string;
  weight: number;
  ordinal?: boolean;
  boolean?: boolean;
  isGood: (e: NutritionHabit) => boolean;
  display: (e: NutritionHabit) => string;
  unit: string;
  pct: (e: NutritionHabit) => number;
  hint: (e: NutritionHabit) => string;
};

const HABIT_METRICS: HabitMetricDef[] = [
  {
    key: 'meals', label: 'Comidas al día', ideal: '≥ 3', weight: 1.0, unit: '/día',
    isGood: (e) => e.meals_per_day >= 3,
    display: (e) => `${e.meals_per_day}`,
    pct: (e) => Math.min(100, (e.meals_per_day / 6) * 100),
    hint: (e) => e.meals_per_day >= 3
      ? `${e.meals_per_day} al día — sostienes energía estable.`
      : `${e.meals_per_day} es poco. Distribuye en 3+ tomas al día.`,
  },
  {
    key: 'water', label: 'Agua diaria', ideal: '≥ 2.0L', weight: 1.5, unit: 'L/día',
    isGood: (e) => parseFloat(e.water_liters) >= 2,
    display: (e) => parseFloat(e.water_liters).toFixed(1),
    pct: (e) => Math.min(100, (parseFloat(e.water_liters) / 3) * 100),
    hint: (e) => parseFloat(e.water_liters) >= 2
      ? 'Por encima del umbral. Sigue así.'
      : `Te faltan ${(2 - parseFloat(e.water_liters)).toFixed(1)}L para llegar al ideal.`,
  },
  {
    key: 'fruit', label: 'Frutas a la semana', ideal: '≥ 5', weight: 1.0, unit: '/semana',
    isGood: (e) => e.fruit_weekly >= 5,
    display: (e) => `${e.fruit_weekly}`,
    pct: (e) => Math.min(100, (e.fruit_weekly / 14) * 100),
    hint: (e) => e.fruit_weekly >= 5
      ? `${e.fruit_weekly} porciones — buena variedad.`
      : `${e.fruit_weekly} es bajo. Apunta a 5+ semanales.`,
  },
  {
    key: 'vegetable', label: 'Verduras a la semana', ideal: '≥ 5', weight: 1.0, unit: '/semana',
    isGood: (e) => e.vegetable_weekly >= 5,
    display: (e) => `${e.vegetable_weekly}`,
    pct: (e) => Math.min(100, (e.vegetable_weekly / 14) * 100),
    hint: (e) => e.vegetable_weekly >= 5
      ? `${e.vegetable_weekly} porciones — buen ritmo.`
      : `${e.vegetable_weekly} es bajo. Incluye verduras a diario.`,
  },
  {
    key: 'protein', label: 'Proteína de calidad', ideal: '≥ 4', weight: 1.5, unit: '/5', ordinal: true,
    isGood: (e) => e.protein_frequency >= 4,
    display: (e) => `${e.protein_frequency}/5`,
    pct: (e) => (e.protein_frequency / 5) * 100,
    hint: (e) => e.protein_frequency >= 4
      ? 'Buena cobertura proteica.'
      : 'Sube a 4–5 incluyendo proteína en cada comida.',
  },
  {
    key: 'ultraprocessed', label: 'Ultraprocesados', ideal: '≤ 3', weight: 1.5, unit: '/semana',
    isGood: (e) => e.ultraprocessed_weekly <= 3,
    display: (e) => `${e.ultraprocessed_weekly}`,
    pct: (e) => Math.max(0, 100 - (e.ultraprocessed_weekly / 14) * 100),
    hint: (e) => e.ultraprocessed_weekly <= 3
      ? 'Bajo consumo — nivel saludable.'
      : `${e.ultraprocessed_weekly} a la semana. Bajar a 3 sube tu score 0.5.`,
  },
  {
    key: 'sugary', label: 'Bebidas azucaradas', ideal: '≤ 2', weight: 1.0, unit: '/semana',
    isGood: (e) => e.sugary_drinks_weekly <= 2,
    display: (e) => `${e.sugary_drinks_weekly}`,
    pct: (e) => Math.max(0, 100 - (e.sugary_drinks_weekly / 14) * 100),
    hint: (e) => e.sugary_drinks_weekly <= 2
      ? 'Controlado — buen nivel.'
      : 'Cambia 1 por agua con frutas la próxima semana.',
  },
  {
    key: 'breakfast', label: 'Desayunas', ideal: 'Sí', weight: 1.5, unit: '', boolean: true,
    isGood: (e) => e.eats_breakfast === true,
    display: (e) => (e.eats_breakfast ? 'Sí' : 'No'),
    pct: (e) => (e.eats_breakfast ? 100 : 0),
    hint: (e) => (e.eats_breakfast
      ? 'Adherencia matinal sólida.'
      : 'Empieza a desayunar — tu cuerpo arranca con combustible.'),
  },
];

// Aligned with backend: s ≤ 4 red · s ≤ 7 yellow · s > 7 green
function habitBand(score: number): { name: string; color: string } {
  if (score > 7) return { name: 'Favorables', color: '#A8C29C' };
  if (score > 4) return { name: 'Intermedios', color: '#E5C97A' };
  return { name: 'Por mejorar', color: '#E4A8A8' };
}

function formatHabitDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function HabitSparkline({ data, color, w = 280, h = 44 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (data.length < 2) return <span style={{ display: 'inline-block', width: w, height: h }} />;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 10);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.85 - h * 0.075;
    return [x, y] as [number, number];
  });
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block', maxWidth: '100%' }}>
      <defs>
        <linearGradient id="habit-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#habit-spark-fill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p[0]} cy={p[1]}
          r={i === pts.length - 1 ? 3.5 : 2}
          fill={i === pts.length - 1 ? '#FFF8EC' : color}
          stroke={i === pts.length - 1 ? color : 'none'}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

function HabitMetricBar({ entry, m }: { entry: NutritionHabit; m: HabitMetricDef }) {
  const ok = m.isGood(entry);
  const color = ok ? '#A8C29C' : '#E5C97A';
  const pct = m.pct(entry);
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.78)',
        border: ok ? '1px solid rgba(168,194,156,0.30)' : '1px solid rgba(229,201,122,0.30)',
        boxShadow: '0 2px 8px -4px rgba(45,15,26,0.10)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="font-heading text-[14px] font-semibold truncate" style={{ color: '#670F22' }}>{m.label}</span>
        <span
          className="text-[9px] font-bold uppercase shrink-0"
          style={{ letterSpacing: '0.16em', color }}
        >
          {ok ? '✓ Cumple' : '↻ Mejorar'}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="flex items-baseline gap-1">
          <span
            className="font-heading font-semibold tabular-nums"
            style={{ color: '#670F22', fontSize: 22 }}
          >
            {m.display(entry)}
          </span>
          {!m.boolean && !m.ordinal && (
            <span className="text-[10px]" style={{ color: 'rgba(103,15,34,0.55)' }}>{m.unit}</span>
          )}
        </div>
        <span className="text-[10px]" style={{ color: 'rgba(103,15,34,0.55)' }}>Ideal {m.ideal}</span>
      </div>
      <div className="relative" style={{ height: 5, borderRadius: 3, background: 'rgba(103,15,34,0.06)', overflow: 'hidden' }}>
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}AA, ${color})`,
            borderRadius: 3,
            transition: 'width 600ms ease-out',
          }}
        />
      </div>
      <p className="text-[11px] italic mt-2 leading-[1.45]" style={{ color: 'rgba(103,15,34,0.65)' }}>
        {m.hint(entry)}
      </p>
    </div>
  );
}

// ─── Habits form modal ───────────────────────────────────────────────────────

const DEFAULT_FORM: NutritionFormData = {
  meals_per_day: 3,
  water_liters: 2,
  fruit_weekly: 7,
  vegetable_weekly: 7,
  protein_frequency: 3,
  ultraprocessed_weekly: 4,
  sugary_drinks_weekly: 2,
  eats_breakfast: true,
  notes: '',
};

type StepperProps = {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  ideal: string;
  onChange: (v: number) => void;
};

function HabitStepper({ label, hint, value, min, max, step, unit, ideal, onChange }: StepperProps) {
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(1)));
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(1)));
  return (
    <div
      className="rounded-2xl"
      style={{
        padding: 16,
        background: 'rgba(255,255,255,0.65)',
        border: '1px solid rgba(103,15,34,0.08)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="font-heading text-[14px] font-semibold" style={{ color: '#670F22' }}>{label}</span>
        <span className="text-[10px]" style={{ color: 'rgba(103,15,34,0.55)' }}>Ideal {ideal}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          aria-label="Disminuir"
          className="grid place-items-center transition-colors disabled:opacity-40 active:scale-95"
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(103,15,34,0.06)',
            color: '#670F22',
          }}
        >
          <Minus size={16} strokeWidth={2.2} />
        </button>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-heading font-semibold tabular-nums"
            style={{ color: '#670F22', fontSize: 28, letterSpacing: '-0.01em' }}
          >
            {step < 1 ? value.toFixed(1) : value}
          </span>
          {unit && <span className="text-[12px]" style={{ color: 'rgba(103,15,34,0.55)' }}>{unit}</span>}
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          aria-label="Aumentar"
          className="grid place-items-center transition-colors disabled:opacity-40 active:scale-95"
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
            color: '#fff',
          }}
        >
          <Plus size={16} strokeWidth={2.2} />
        </button>
      </div>
      <p className="text-[11px] italic mt-2 leading-[1.4]" style={{ color: 'rgba(103,15,34,0.55)' }}>{hint}</p>
    </div>
  );
}

function HabitsFormModal({
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: NutritionHabit | null;
}) {
  const { createEntry, submitting, error } = useNutritionStore();

  const seed: NutritionFormData = initial
    ? {
        meals_per_day: initial.meals_per_day,
        water_liters: parseFloat(initial.water_liters) || 2,
        fruit_weekly: initial.fruit_weekly,
        vegetable_weekly: initial.vegetable_weekly,
        protein_frequency: initial.protein_frequency,
        ultraprocessed_weekly: initial.ultraprocessed_weekly,
        sugary_drinks_weekly: initial.sugary_drinks_weekly,
        eats_breakfast: initial.eats_breakfast,
        notes: '',
      }
    : DEFAULT_FORM;

  const [form, setForm] = useState<NutritionFormData>(seed);
  const [localError, setLocalError] = useState('');

  // Reset form to seed when modal opens
  useEffect(() => {
    if (open) {
      setForm(seed);
      setLocalError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = async () => {
    setLocalError('');
    const result = await createEntry(form);
    if (result) {
      onClose();
    } else {
      setLocalError(error || 'No se pudo guardar el registro.');
    }
  };

  const set = <K extends keyof NutritionFormData>(k: K, v: NutritionFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const proteinLabels = ['Casi nunca', 'A veces', 'Regular', 'Frecuente', 'Cada comida'];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(45,15,26,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative w-full md:max-w-2xl max-h-[92vh] overflow-y-auto"
            style={{
              background: 'linear-gradient(180deg, #FAF3E4 0%, #F5EFE3 100%)',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -16px 40px -12px rgba(45,15,26,0.35)',
            }}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          >
            {/* desktop fix: round all corners */}
            <style>{`@media (min-width: 768px){ .habits-modal-sheet { border-radius: 28px !important; } }`}</style>
            <div className="habits-modal-sheet" style={{ padding: 24 }}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-4 mb-4" style={{ borderBottom: '1px solid rgba(103,15,34,0.08)' }}>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>
                    Registro semanal
                  </p>
                  <h2 className="font-heading text-2xl font-semibold mt-1.5" style={{ color: '#670F22', letterSpacing: '-0.01em' }}>
                    Actualizar hábitos
                  </h2>
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(103,15,34,0.6)' }}>
                    Cuéntanos cómo va esta semana. Tarda menos de 1 minuto.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid place-items-center shrink-0 active:scale-95 transition-transform"
                  style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: 'rgba(103,15,34,0.06)',
                    color: '#670F22',
                  }}
                  aria-label="Cerrar"
                >
                  <X size={16} strokeWidth={2.2} />
                </button>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <HabitStepper
                  label="Comidas al día"
                  hint="Distribución de comidas a lo largo del día."
                  value={form.meals_per_day}
                  min={1} max={10} step={1} unit="al día" ideal="≥ 3"
                  onChange={(v) => set('meals_per_day', v)}
                />
                <HabitStepper
                  label="Agua diaria"
                  hint="Vasos de ~250 mL ≈ 0.25 L. 8 vasos ≈ 2 L."
                  value={form.water_liters}
                  min={0} max={6} step={0.1} unit="L" ideal="≥ 2.0"
                  onChange={(v) => set('water_liters', v)}
                />
                <HabitStepper
                  label="Frutas a la semana"
                  hint="Cuenta porciones. 1 manzana = 1 porción."
                  value={form.fruit_weekly}
                  min={0} max={35} step={1} unit="/sem" ideal="≥ 5"
                  onChange={(v) => set('fruit_weekly', v)}
                />
                <HabitStepper
                  label="Verduras a la semana"
                  hint="1 plato de ensalada o cocinada = 1 porción."
                  value={form.vegetable_weekly}
                  min={0} max={35} step={1} unit="/sem" ideal="≥ 5"
                  onChange={(v) => set('vegetable_weekly', v)}
                />

                {/* Protein frequency — segmented buttons */}
                <div
                  className="rounded-2xl md:col-span-2"
                  style={{ padding: 16, background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(103,15,34,0.08)' }}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-2.5">
                    <span className="font-heading text-[14px] font-semibold" style={{ color: '#670F22' }}>Proteína de calidad</span>
                    <span className="text-[10px]" style={{ color: 'rgba(103,15,34,0.55)' }}>Ideal ≥ 4</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {proteinLabels.map((lbl, i) => {
                      const v = i + 1;
                      const active = form.protein_frequency === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => set('protein_frequency', v)}
                          className="text-[10.5px] font-semibold transition-colors"
                          style={{
                            padding: '10px 6px',
                            borderRadius: 12,
                            background: active ? 'linear-gradient(135deg, #9A0526, #AB0D2F)' : 'rgba(103,15,34,0.05)',
                            color: active ? '#fff' : '#670F22',
                            border: active ? '1px solid rgba(154,5,38,0.5)' : '1px solid rgba(103,15,34,0.10)',
                            boxShadow: active ? '0 4px 12px -4px rgba(154,5,38,0.4)' : 'none',
                            lineHeight: 1.2,
                          }}
                        >
                          <div className="font-heading text-[14px] font-bold mb-0.5">{v}</div>
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] italic mt-2 leading-[1.4]" style={{ color: 'rgba(103,15,34,0.55)' }}>
                    1 = casi nunca · 5 = en cada comida.
                  </p>
                </div>

                <HabitStepper
                  label="Ultraprocesados"
                  hint="Snacks, embutidos, panes industriales, comida rápida."
                  value={form.ultraprocessed_weekly}
                  min={0} max={35} step={1} unit="/sem" ideal="≤ 3"
                  onChange={(v) => set('ultraprocessed_weekly', v)}
                />
                <HabitStepper
                  label="Bebidas azucaradas"
                  hint="Gaseosas, jugos azucarados, bebidas energéticas."
                  value={form.sugary_drinks_weekly}
                  min={0} max={35} step={1} unit="/sem" ideal="≤ 2"
                  onChange={(v) => set('sugary_drinks_weekly', v)}
                />

                {/* Breakfast — toggle */}
                <div
                  className="rounded-2xl md:col-span-2"
                  style={{ padding: 16, background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(103,15,34,0.08)' }}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <span className="font-heading text-[14px] font-semibold" style={{ color: '#670F22' }}>¿Desayunas regularmente?</span>
                      <p className="text-[11px] italic mt-0.5" style={{ color: 'rgba(103,15,34,0.55)' }}>
                        Idealmente, sí. Una comida sólida a la mañana.
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {[true, false].map((v) => {
                        const active = form.eats_breakfast === v;
                        return (
                          <button
                            key={String(v)}
                            type="button"
                            onClick={() => set('eats_breakfast', v)}
                            className="text-[12px] font-semibold transition-colors active:scale-95"
                            style={{
                              padding: '10px 22px',
                              borderRadius: 12,
                              background: active
                                ? (v ? 'linear-gradient(135deg, #A8C29C, #8BAA80)' : 'linear-gradient(135deg, #E5C97A, #C9A96B)')
                                : 'rgba(103,15,34,0.05)',
                              color: active ? '#fff' : '#670F22',
                              border: active ? '1px solid rgba(103,15,34,0.10)' : '1px solid rgba(103,15,34,0.08)',
                              boxShadow: active ? '0 4px 10px -4px rgba(45,15,26,0.18)' : 'none',
                            }}
                          >
                            {v ? 'Sí' : 'No'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold uppercase block mb-1.5" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.55)' }}>
                    Notas (opcional)
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="Algo que quieras contarle a tu coach esta semana…"
                    rows={3}
                    className="w-full text-[13px] resize-none"
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(103,15,34,0.12)',
                      color: '#3A2128',
                      outline: 'none',
                      lineHeight: 1.55,
                    }}
                  />
                </div>
              </div>

              {/* Error */}
              {(localError || error) && (
                <div
                  className="mt-4 px-4 py-3 rounded-xl text-[12px] leading-[1.5]"
                  style={{
                    background: 'rgba(228,168,168,0.18)',
                    border: '1px solid rgba(228,168,168,0.4)',
                    color: '#9A0526',
                  }}
                >
                  {localError || error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 mt-5 pt-4" style={{ borderTop: '1px solid rgba(103,15,34,0.08)' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[12px] font-semibold active:scale-95 transition-transform"
                  style={{
                    padding: '11px 18px',
                    borderRadius: 12,
                    background: 'rgba(103,15,34,0.05)',
                    color: '#670F22',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="text-[12px] font-semibold text-white active:scale-95 transition-transform disabled:opacity-60"
                  style={{
                    padding: '11px 22px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
                    boxShadow: '0 4px 12px -4px rgba(154,5,38,0.4)',
                  }}
                >
                  {submitting ? 'Guardando…' : 'Guardar registro'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyNutritionPage() {
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [uploadingMealId, setUploadingMealId] = useState<number | null>(null);
  const [waterDrank, setWaterDrank] = useState(0);
  const [habitsOpen, setHabitsOpen] = useState(false);
  const [showHabitsModal, setShowHabitsModal] = useState(false);
  const { entries, fetchMyEntries } = useNutritionStore();
  const { todayLog, loading: dailyLoading, fetchTodayLog, updateMealEntry, uploadMealPhoto } = useNutritionDailyStore();

  useEffect(() => {
    fetchTodayLog();
    fetchMyEntries();
  }, [fetchTodayLog, fetchMyEntries]);

  const latest = entries[0] ?? null;
  const meals = todayLog?.meal_entries ?? [];
  const completedMeals = meals.filter(m => m.status === 'completed');
  const eatenKcal = completedMeals.reduce((acc, m) => acc + (m.suggestion?.calories_estimate ?? 0), 0);
  const totalKcal = meals.reduce((acc, m) => acc + (m.suggestion?.calories_estimate ?? 0), 0);

  const waterGoalLiters = latest ? parseFloat(latest.water_liters) : 2;
  const waterGoalGlasses = Math.max(6, Math.round(waterGoalLiters * 4));

  const habitScore = latest?.habit_score ? parseFloat(latest.habit_score) : null;
  const habitColorStroke = { green: '#10B981', yellow: '#F59E0B', red: '#EF4444' }[latest?.habit_color ?? ''] ?? '#AB0D2F';

  // Macro targets derived from program goal + calorie estimates
  const macros = totalKcal > 0 ? (() => {
    const [pRatio, cRatio, fRatio] = MACRO_RATIOS[todayLog?.program_goal ?? ''] ?? MACRO_RATIOS.general_health;
    const completedRatio = totalKcal > 0 ? eatenKcal / totalKcal : 0;
    const pGoal = Math.round(totalKcal * pRatio / 4);
    const cGoal = Math.round(totalKcal * cRatio / 4);
    const fGoal = Math.round(totalKcal * fRatio / 9);
    return [
      { label: 'Proteína', eaten: Math.round(pGoal * completedRatio), goal: pGoal, unit: 'g', color: '#FF4040' },
      { label: 'Carbos',   eaten: Math.round(cGoal * completedRatio), goal: cGoal, unit: 'g', color: '#F59E0B' },
      { label: 'Grasas',   eaten: Math.round(fGoal * completedRatio), goal: fGoal, unit: 'g', color: '#CD0C36' },
    ];
  })() : null;

  // Calorie ring params (200px, r=86)
  const ringR = 86;
  const ringCirc = 2 * Math.PI * ringR;
  const ringPct = totalKcal > 0 ? Math.min(1, eatenKcal / totalKcal) : 0;
  const ringOffset = ringCirc * (1 - ringPct);

  const dateLabel = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const photoEntries = meals.filter(m => m.photo_url);

  const handlePhotoAndComplete = async (logId: number, mealId: number, rawFile: File) => {
    setUploadingMealId(mealId);
    try {
      const compressed = await compressImage(rawFile);
      await uploadMealPhoto(logId, mealId, compressed);
      await updateMealEntry(logId, mealId, 'completed');
    } finally {
      setUploadingMealId(null);
    }
  };

  return (
    <section className="min-h-screen bg-kore-cream">
      <style>{ORB_STYLES}</style>
      <div className="w-full px-5 xl:px-10 pt-6 xl:pt-8 pb-24">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-1">Mi Nutrición</p>
          <h1 className="font-heading text-[22px] font-semibold text-kore-wine-dark leading-tight capitalize">{dateLabel}</h1>
        </div>

        {/* ── AnimatedHero ────────────────────────────────────────────────────── */}
        {dailyLoading && !todayLog ? (
          <div className="relative overflow-hidden rounded-[22px] shadow-2xl flex justify-center items-center" style={{ background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)', minHeight: 200 }}>
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
          </div>
        ) : !todayLog ? (
          <div className="relative overflow-hidden rounded-[22px] shadow-2xl text-center py-14 px-8" style={{ background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)' }}>
            {/* Orbs */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,233,220,0.20) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(20,5,12,0.65) 0%, transparent 55%)', animation: 'kore-aurora 8s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ top: '20%', right: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)', filter: 'blur(30px)', animation: 'kore-orb-1 9s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ bottom: '10%', left: '20%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'kore-orb-2 11s ease-in-out infinite' }} />
            <div className="relative z-10 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#E7C8A0' }}>Mi nutrición · Hoy</p>
              <h2 className="font-heading text-2xl font-semibold" style={{ color: '#FFF8EC', letterSpacing: '-0.01em' }}>Sin plan activo</h2>
              <p className="text-sm leading-relaxed" style={{ color: '#FFE9DC', opacity: 0.78 }}>Necesitas un programa mensual activo para ver tu plan nutricional del día.</p>
              <Link href="/mi-programa" className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-kore-red text-white text-sm font-semibold active:scale-95 transition-transform">
                Ver mi programa →
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[22px] shadow-2xl" style={{ background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)', minHeight: 280 }}>
            {/* Aurora + Orbs */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,233,220,0.20) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(20,5,12,0.65) 0%, transparent 55%)', animation: 'kore-aurora 8s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ top: '20%', right: '8%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)', filter: 'blur(30px)', animation: 'kore-orb-1 9s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ bottom: '10%', left: '20%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'kore-orb-2 11s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ top: '50%', left: '50%', width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,194,156,0.18) 0%, transparent 70%)', filter: 'blur(35px)', animation: 'kore-orb-3 7s ease-in-out infinite' }} />

            {/* Content grid: 1fr 200px on desktop, stacked on mobile */}
            <div className="relative z-10 p-7 xl:p-9 flex flex-col xl:grid xl:items-center gap-7 xl:gap-9" style={{ gridTemplateColumns: '1fr 220px' }}>
              {/* Left */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#E7C8A0' }}>Mi nutrición · Hoy</p>
                <h2 className="font-heading text-[28px] xl:text-[38px] font-semibold mt-3 leading-[1.05]" style={{ color: '#FFF8EC', letterSpacing: '-0.015em' }}>Tu día, en equilibrio.</h2>
                <p className="text-sm mt-2.5 leading-relaxed" style={{ color: '#FFE9DC', opacity: 0.85 }}>
                  {todayLog.program_goal === 'fat_loss' && 'Objetivo: pérdida de grasa · Mayor proteína, menos carbos.'}
                  {todayLog.program_goal === 'muscle_gain' && 'Objetivo: ganancia muscular · Mayor carbos, más energía.'}
                  {(!todayLog.program_goal || todayLog.program_goal === 'general_health') && 'Objetivo: salud general · Alimentación equilibrada.'}
                </p>
                {todayLog.is_closed && (
                  <span className="mt-3 inline-block px-3 py-1 rounded-full border border-white/20 bg-white/10 text-[10px] font-semibold text-white/70">Día cerrado</span>
                )}

                {/* Macro bars */}
                {macros && (
                  <div className="mt-5 grid grid-cols-3 gap-3.5" style={{ maxWidth: 480 }}>
                    {macros.map(({ label, eaten, goal, unit, color }) => {
                      const pct = goal > 0 ? Math.min(100, (eaten / goal) * 100) : 0;
                      return (
                        <div key={label}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">{label}</span>
                            <span className="text-[11px] font-semibold text-white/85 tabular-nums">
                              {eaten}<span className="opacity-50">/{goal}{unit}</span>
                            </span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}99`, transition: 'width 700ms ease-out' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: calorie ring */}
              <div className="flex flex-col items-center xl:items-center">
                <div className="relative" style={{ width: 200, height: 200 }}>
                  <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
                    <defs>
                      <linearGradient id="kcal-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FF4040" />
                        <stop offset="100%" stopColor="#9A0526" />
                      </linearGradient>
                    </defs>
                    <circle cx="100" cy="100" r={ringR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                    <circle
                      cx="100" cy="100" r={ringR} fill="none"
                      stroke="url(#kcal-grad)" strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={ringCirc}
                      strokeDashoffset={ringOffset}
                      style={{ filter: 'drop-shadow(0 0 8px rgba(255,64,64,0.5))', transition: 'stroke-dashoffset 800ms ease-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Consumidas</span>
                    <span className="font-heading text-[38px] font-bold text-white leading-none mt-1">{eatenKcal}</span>
                    <span className="text-xs text-white/55 mt-1">de {totalKcal} kcal</span>
                  </div>
                </div>
                <div className="mt-3 px-3.5 py-1.5 rounded-full border border-white/15" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <span className="text-[11px] font-semibold text-white">
                    {completedMeals.length} / {meals.length} comidas
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Coach tip strip — only shown when trainer set a note on the program ── */}
        {todayLog?.trainer_nutrition_note && (
          <div className="mt-4 flex items-center gap-3.5 bg-white rounded-2xl border border-kore-gray-light/60 px-5 py-3.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #9A0526, #AB0D2F)' }}>
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-kore-red">Tu coach te recomienda</p>
              <p className="text-[13px] font-medium text-kore-gray-dark mt-0.5 leading-snug">
                {todayLog.trainer_nutrition_note}
              </p>
            </div>
          </div>
        )}

        {/* ── Main grid: meals (left 7) + sidebar (right 5) ──────────────────── */}
        {todayLog && meals.length > 0 && (
          <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* ── Meals timeline (7 cols) ─────────────────────────────────────── */}
            <div className="xl:col-span-7">
              <div className="flex items-baseline justify-between mb-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/42">Tu día · timeline</p>
              </div>

              <div className="relative flex flex-col gap-2.5">
                {/* Vertical timeline line */}
                <div className="absolute pointer-events-none" style={{ left: 28, top: 28, bottom: 28, width: 2, background: 'linear-gradient(180deg, rgba(102,15,34,0.18) 0%, rgba(102,15,34,0.06) 100%)' }} />

                {meals.map((meal) => {
                  const isOpen = expandedMeal === meal.id;
                  const isDone = meal.status === 'completed';
                  const isSkipped = meal.status === 'skipped';
                  const mealTime = BLOCK_TIME[meal.meal_block] ?? '';
                  const isUploading = uploadingMealId === meal.id;
                  const quickInputId = `photo-quick-${meal.id}`;
                  const changeInputId = `photo-change-${meal.id}`;

                  return (
                    <div key={meal.id} className="relative">
                      {/* Hidden quick-upload input (no photo yet → single tap from header) */}
                      {!todayLog.is_closed && !isDone && (
                        <input
                          id={quickInputId}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={isUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            await handlePhotoAndComplete(todayLog.id, meal.id, file);
                            e.target.value = '';
                          }}
                        />
                      )}
                      {/* Hidden change-photo input (already done) */}
                      {!todayLog.is_closed && isDone && (
                        <input
                          id={changeInputId}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={isUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            await handlePhotoAndComplete(todayLog.id, meal.id, file);
                            e.target.value = '';
                          }}
                        />
                      )}

                      <div
                        onClick={() => !todayLog.is_closed && setExpandedMeal(isOpen ? null : meal.id)}
                        className="rounded-[18px] transition-all duration-200"
                        style={{
                          background: '#ffffff',
                          padding: 16,
                          cursor: todayLog.is_closed ? 'default' : 'pointer',
                          border: isOpen ? '1px solid rgba(224,0,0,0.2)' : '1px solid rgba(229,229,229,0.6)',
                          boxShadow: isOpen ? '0 8px 24px -10px rgba(154,5,38,0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        {/* ── Collapsed header row ── */}
                        <div className="flex items-center gap-3.5">
                          {/* Time / check circle */}
                          <div
                            className="flex-shrink-0 flex items-center justify-center relative z-10"
                            style={{
                              width: 56, height: 56, borderRadius: 14,
                              background: isDone
                                ? 'linear-gradient(135deg, #10B981, #047857)'
                                : isSkipped
                                  ? 'rgba(245,158,11,0.12)'
                                  : 'linear-gradient(135deg, rgba(102,15,34,0.08), rgba(154,5,38,0.04))',
                              border: '3px solid #EDE8DC',
                            }}
                          >
                            {isDone ? (
                              <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
                            ) : (
                              <span className="text-[11px] font-bold tabular-nums" style={{ color: '#670F22', letterSpacing: '0.05em' }}>{mealTime}</span>
                            )}
                          </div>

                          {/* Meal info: raw foods (primary) + recipe name (secondary) */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/50">
                                {BLOCK_LABEL[meal.meal_block] ?? meal.meal_block}
                              </span>
                              {meal.suggestion && (
                                <>
                                  <span className="w-[3px] h-[3px] rounded-full bg-kore-gray-dark/30 flex-shrink-0" />
                                  <span className="text-[11px] font-semibold text-kore-gray-dark/50">{meal.suggestion.calories_estimate} kcal</span>
                                </>
                              )}
                            </div>
                            {/* Primary: food names from catalog, or description fallback */}
                            <p className="text-sm font-semibold text-kore-gray-dark mt-0.5 truncate">
                              {meal.suggestion?.foods?.length
                                ? meal.suggestion.foods.map(f => formatFoodName(f.name)).join(' · ')
                                : (meal.suggestion?.description ?? 'Sin descripción')}
                            </p>
                            {/* Secondary: recipe title — only when ingredients are shown */}
                            {meal.suggestion?.title && !!meal.suggestion.foods?.length && (
                              <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(102,15,34,0.5)' }}>
                                Receta: {meal.suggestion.title}
                              </p>
                            )}
                          </div>

                          {/* Right action — photo required to complete */}
                          {!todayLog.is_closed && (
                            isUploading ? (
                              <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-kore-red border-t-transparent" />
                              </div>
                            ) : isDone ? (
                              <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl" style={{ background: '#10B981', color: '#fff' }}>
                                <Check className="w-3 h-3" strokeWidth={2.5} /> Hecha
                              </span>
                            ) : (
                              <label
                                htmlFor={quickInputId}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-transform"
                                style={{ background: 'rgba(102,15,34,0.07)', color: '#670F22' }}
                              >
                                <Camera className="w-3.5 h-3.5" strokeWidth={2} />
                                Foto
                              </label>
                            )
                          )}
                        </div>

                        {/* ── Expanded panel ── */}
                        {isOpen && !todayLog.is_closed && (
                          <div className="mt-3.5 pt-3.5 border-t border-kore-gray-light/60" onClick={(e) => e.stopPropagation()}>
                            {/* Ingredients — food chips from catalog if linked, else description */}
                            {(meal.suggestion?.foods?.length || meal.suggestion?.description) && (
                              <div className="mb-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/40 mb-2">Ingredientes base</p>
                                {meal.suggestion.foods?.length ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {meal.suggestion.foods.map(f => (
                                      <span key={f.id} className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'rgba(102,15,34,0.06)', color: '#670F22' }}>
                                        {formatFoodName(f.name)}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[13px] text-kore-gray-dark leading-relaxed">{meal.suggestion?.description}</p>
                                )}
                              </div>
                            )}
                            {/* Recipe suggestion */}
                            {meal.suggestion?.title && (
                              <div className="mb-4 flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(102,15,34,0.04)' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-kore-gray-dark/40 flex-shrink-0">Receta</span>
                                <span className="text-[13px] font-medium text-kore-wine-dark leading-snug">{meal.suggestion.title}</span>
                              </div>
                            )}

                            {/* Photo upload — required for completion */}
                            <div className="mb-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/40 mb-2">Foto de confirmación (obligatoria)</p>
                              {meal.photo_url ? (
                                <div className="space-y-2">
                                  <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16/7' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={meal.photo_url} alt="Foto de comida" className="w-full h-full object-cover" />
                                    <label
                                      htmlFor={changeInputId}
                                      className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-lg cursor-pointer"
                                      style={{ background: 'rgba(0,0,0,0.5)' }}
                                    >
                                      <Camera className="w-3 h-3 text-white" strokeWidth={2} />
                                      <span className="text-[10px] font-semibold text-white">Cambiar</span>
                                    </label>
                                  </div>
                                  {/* Shown when photo uploaded but completion failed (network error) */}
                                  {!isDone && (
                                    <button
                                      onClick={() => updateMealEntry(todayLog.id, meal.id, 'completed')}
                                      className="w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                      style={{ background: 'linear-gradient(135deg, #10B981, #047857)', color: '#fff' }}
                                    >
                                      <Check className="w-4 h-4" strokeWidth={2.5} />
                                      Marcar como hecha
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <label
                                  htmlFor={quickInputId}
                                  className="flex flex-col items-center justify-center gap-2 w-full rounded-xl cursor-pointer"
                                  style={{
                                    minHeight: 96,
                                    border: '1.5px dashed rgba(102,15,34,0.25)',
                                    background: 'rgba(102,15,34,0.03)',
                                  }}
                                >
                                  {isUploading ? (
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
                                  ) : (
                                    <>
                                      <Camera className="w-7 h-7" style={{ color: 'rgba(102,15,34,0.35)' }} strokeWidth={1.5} />
                                      <p className="text-[12px] font-semibold text-center" style={{ color: 'rgba(102,15,34,0.5)' }}>
                                        Sube una foto para<br />confirmar esta comida
                                      </p>
                                    </>
                                  )}
                                </label>
                              )}
                            </div>

                            {/* Omití */}
                            <button
                              onClick={() => updateMealEntry(todayLog.id, meal.id, isSkipped ? 'not_done' : 'skipped')}
                              className="w-full py-2 rounded-xl text-[12px] font-semibold transition-colors"
                              style={{
                                background: isSkipped ? 'rgba(51,51,51,0.12)' : 'rgba(51,51,51,0.05)',
                                color: isSkipped ? 'rgba(51,51,51,0.75)' : 'rgba(51,51,51,0.40)',
                              }}
                            >
                              {isSkipped ? '✓ Marcada como omitida · deshacer' : 'Omití esta comida'}
                            </button>
                          </div>
                        )}

                        {/* Closed day: show photo thumbnail */}
                        {todayLog.is_closed && meal.photo_url && (
                          <div className="mt-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={meal.photo_url} alt="Foto" className="w-full h-28 object-cover rounded-xl" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── 8 Hábitos accordion (debajo del timeline) ─────────────────── */}
              {latest && (() => {
                const strengths = HABIT_METRICS.filter((m) => m.isGood(latest));
                const improvements = HABIT_METRICS.filter((m) => !m.isGood(latest));
                return (
                  <div
                    className="mt-5 bg-white/65 rounded-[18px] border border-kore-gray-light/50 shadow-sm overflow-hidden"
                    style={{ boxShadow: '0 4px 16px -10px rgba(45,15,26,0.12)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setHabitsOpen((v) => !v)}
                      className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.55)' }}>
                          Tus 8 hábitos
                        </p>
                        <div className="flex items-baseline gap-3 flex-wrap mt-1">
                          <p className="font-heading text-[18px] font-semibold" style={{ color: '#670F22' }}>Balance de la semana</p>
                          <span className="text-[11px]" style={{ color: 'rgba(103,15,34,0.55)' }}>
                            <span className="font-semibold" style={{ color: '#669959' }}>{strengths.length} cumplen</span>
                            {' · '}
                            <span className="font-semibold" style={{ color: '#A88A2E' }}>{improvements.length} por mejorar</span>
                          </span>
                        </div>
                      </div>
                      <span
                        className="grid place-items-center shrink-0 transition-transform"
                        style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: 'rgba(103,15,34,0.06)',
                          color: '#670F22',
                          transform: habitsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                        aria-hidden
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </button>

                    {habitsOpen && (
                      <div className="px-5 pb-5 grid gap-5 lg:grid-cols-2">
                        {/* Cumple */}
                        {strengths.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2.5">
                              <span
                                className="grid place-items-center font-heading font-bold text-[12px]"
                                style={{ width: 22, height: 22, borderRadius: 11, background: 'rgba(168,194,156,0.25)', color: '#669959' }}
                              >
                                ✓
                              </span>
                              <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: '#669959' }}>
                                Cumple · {strengths.length}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2.5">
                              {strengths.map((m) => (
                                <HabitMetricBar key={m.key} entry={latest} m={m} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Mejorar */}
                        {improvements.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2.5">
                              <span
                                className="grid place-items-center font-heading font-bold text-[12px]"
                                style={{ width: 22, height: 22, borderRadius: 11, background: 'rgba(229,201,122,0.25)', color: '#A88A2E' }}
                              >
                                ↻
                              </span>
                              <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: '#A88A2E' }}>
                                Por mejorar · {improvements.length}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2.5">
                              {improvements.map((m) => (
                                <HabitMetricBar key={m.key} entry={latest} m={m} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* ── Right sidebar (5 cols) ──────────────────────────────────────── */}
            <div className="xl:col-span-5 flex flex-col gap-4">

              {/* Water tracker */}
              <div className="relative overflow-hidden rounded-[18px]" style={{ background: 'linear-gradient(135deg, #2D0F1A 0%, #5C2030 100%)', padding: 24, boxShadow: '0 8px 24px -10px rgba(45,15,26,0.5)' }}>
                <div className="absolute pointer-events-none" style={{ top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(64,156,255,0.35) 0%, transparent 70%)', filter: 'blur(20px)', animation: 'water-wave 6s ease-in-out infinite' }} />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Hidratación</p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="font-heading text-[36px] font-bold text-white leading-none">{waterDrank}</span>
                    <span className="text-sm text-white/55">/ {waterGoalGlasses} vasos</span>
                  </div>
                  <div className="mt-4 flex gap-1.5">
                    {Array.from({ length: waterGoalGlasses }, (_, i) => {
                      const filled = i < waterDrank;
                      return (
                        <button
                          key={i}
                          onClick={() => setWaterDrank(filled ? i : i + 1)}
                          className="flex-1 rounded-lg transition-all duration-200 active:scale-95"
                          style={{
                            height: 34,
                            background: filled ? 'linear-gradient(180deg, #4DA3FF, #0B6BC4)' : 'rgba(255,255,255,0.08)',
                            border: filled ? 'none' : '1px solid rgba(255,255,255,0.12)',
                            boxShadow: filled ? '0 0 12px rgba(77,163,255,0.4)' : 'none',
                          }}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[12px] mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    +1 vaso = tap. Te quedan {Math.max(0, waterGoalGlasses - waterDrank)} para cerrar el día.
                  </p>
                </div>
              </div>

              {/* ─── Habits redesign ─── Hero · 8 hábitos · trayectoria · siguiente paso */}
              {latest && habitScore !== null && (() => {
                const ringR = 38;
                const ringCirc = 2 * Math.PI * ringR;
                const ringPctVal = Math.min(habitScore / 10, 1);
                const ringOffsetH = ringCirc * (1 - ringPctVal);
                const b = habitBand(habitScore);
                const ascendingEntries = [...entries].sort((a, b1) => new Date(a.created_at).getTime() - new Date(b1.created_at).getTime());
                const recentEntries = ascendingEntries.slice(-6);
                const sparkData = recentEntries.map((e) => parseFloat(e.habit_score ?? '0')).filter((n) => Number.isFinite(n));
                const prevEntry = entries[1];
                const prevScore = prevEntry?.habit_score ? parseFloat(prevEntry.habit_score) : null;
                const delta = prevScore !== null ? habitScore - prevScore : null;
                const cumpleCount = HABIT_METRICS.filter((m) => m.isGood(latest)).length;
                const improvements = HABIT_METRICS.filter((m) => !m.isGood(latest));
                const firstImprove = improvements[0];
                const historyForTimeline = entries.slice(0, 6);
                return (
                  <>
                    {/* HERO — wine compact */}
                    <div
                      className="relative overflow-hidden text-white"
                      style={{
                        borderRadius: 22,
                        background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
                        padding: 22,
                        boxShadow: '0 16px 40px -16px rgba(45,15,26,0.55), inset 0 1px 0 rgba(255,233,220,0.10), 0 0 0 1px rgba(231,200,160,0.08)',
                      }}
                    >
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          top: '-30%', right: '-15%', width: 240, height: 240, borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(255,233,220,0.18) 0%, transparent 70%)',
                          filter: 'blur(40px)',
                        }}
                      />
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          bottom: '-30%', left: '-10%', width: 200, height: 200, borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(244,199,199,0.18) 0%, transparent 70%)',
                          filter: 'blur(45px)',
                        }}
                      />
                      <div className="relative">
                        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: '#E7C8A0' }}>
                          Score semanal · {formatHabitDate(latest.created_at)}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          {/* score ring */}
                          <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
                            <svg width="96" height="96" style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 4px 14px rgba(244,199,199,0.18))' }}>
                              <defs>
                                <linearGradient id="habit-score-grad" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#FFE9DC" />
                                  <stop offset="50%" stopColor="#E7C8A0" />
                                  <stop offset="100%" stopColor="#C9A77A" />
                                </linearGradient>
                              </defs>
                              <circle cx="48" cy="48" r={ringR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                              <circle
                                cx="48" cy="48" r={ringR}
                                fill="none" stroke="url(#habit-score-grad)" strokeWidth="7" strokeLinecap="round"
                                strokeDasharray={ringCirc} strokeDashoffset={ringOffsetH}
                                style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="font-heading font-semibold leading-none" style={{ color: '#FFF8EC', fontSize: 28, letterSpacing: '-0.01em' }}>
                                {habitScore.toFixed(1)}
                              </span>
                              <span className="text-[9px] mt-1" style={{ color: '#E7C8A0', opacity: 0.85 }}>/ 10</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                              style={{ background: `${b.color}22`, border: `1px solid ${b.color}66`, color: b.color, letterSpacing: '0.10em' }}
                            >
                              ● {b.name}
                            </span>
                            {delta !== null && Math.abs(delta) >= 0.05 && (
                              <p className="mt-1.5 text-[11px] font-semibold tabular-nums" style={{ color: delta > 0 ? '#A8C29C' : '#E4A8A8' }}>
                                {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)} pts vs semana anterior
                              </p>
                            )}
                            <p className="text-[11.5px] mt-2 leading-[1.5]" style={{ color: 'rgba(255,233,220,0.85)' }}>
                              <strong style={{ color: '#E7C8A0', fontWeight: 600 }}>{cumpleCount} de 8 hábitos</strong> en zona favorable.
                            </p>
                          </div>
                        </div>
                        {sparkData.length >= 2 && (
                          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(231,200,160,0.15)' }}>
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(231,200,160,0.7)' }}>
                                Trayectoria · {sparkData.length} sem.
                              </span>
                            </div>
                            <HabitSparkline data={sparkData} color="#E7C8A0" w={320} h={42} />
                          </div>
                        )}

                        {/* Actualizar hábitos — opens modal */}
                        <button
                          type="button"
                          onClick={() => setShowHabitsModal(true)}
                          className="mt-4 w-full flex items-center justify-center gap-2 text-[12px] font-semibold active:scale-[0.98] transition-transform"
                          style={{
                            padding: '11px 16px',
                            borderRadius: 12,
                            background: 'rgba(255,233,220,0.95)',
                            color: '#670F22',
                            border: '1px solid rgba(231,200,160,0.40)',
                            boxShadow: '0 4px 12px -6px rgba(45,15,26,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          <Sparkles size={14} strokeWidth={2} />
                          Actualizar hábitos de la semana
                        </button>
                      </div>
                    </div>

                    {/* FOOD DIARY — debajo del Score, dentro del sidebar */}
                    {photoEntries.length > 0 && (
                      <div
                        className="bg-white/65 rounded-[18px] border border-kore-gray-light/50 shadow-sm"
                        style={{ padding: 20 }}
                      >
                        <div className="flex items-baseline justify-between mb-3 gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.55)' }}>
                              Tu diario fotográfico
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(103,15,34,0.55)' }}>
                              Tu coach revisa tus fotos cada lunes.
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'rgba(103,15,34,0.55)' }}>{photoEntries.length}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {photoEntries.map((m) => (
                            <div
                              key={m.id}
                              className="relative rounded-xl overflow-hidden"
                              style={{ aspectRatio: '1', background: '#3A1822', cursor: 'pointer' }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.photo_url!} alt={BLOCK_LABEL[m.meal_block]} className="w-full h-full object-cover" />
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)' }} />
                              <div className="absolute bottom-1.5 left-2 right-2">
                                <p className="text-[9px] font-semibold text-white/80 uppercase tracking-[0.08em] truncate">{BLOCK_LABEL[m.meal_block]}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TRAYECTORIA — last weeks timeline */}
                    {historyForTimeline.length >= 2 && (
                      <div className="bg-white/65 rounded-[18px] border border-kore-gray-light/50 shadow-sm" style={{ padding: 20 }}>
                        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-1">
                          <div>
                            <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.55)' }}>
                              Tu trayectoria
                            </p>
                            <p className="font-heading text-[16px] font-semibold mt-0.5" style={{ color: '#670F22' }}>
                              {historyForTimeline.length} {historyForTimeline.length === 1 ? 'semana registrada' : 'semanas registradas'}
                            </p>
                          </div>
                          <span className="text-[10px]" style={{ color: 'rgba(103,15,34,0.5)' }}>1 registro / semana</span>
                        </div>
                        <div className="relative" style={{ paddingLeft: 20 }}>
                          <div
                            className="absolute"
                            style={{
                              left: 6, top: 4, bottom: 4, width: 1,
                              background: 'linear-gradient(180deg, transparent 0%, rgba(103,15,34,0.18) 12%, rgba(103,15,34,0.18) 88%, transparent 100%)',
                            }}
                          />
                          {historyForTimeline.map((h, i) => {
                            const score = h.habit_score ? parseFloat(h.habit_score) : 0;
                            const histB = habitBand(score);
                            const isLatest = i === 0;
                            const pct = (score / 10) * 100;
                            return (
                              <div
                                key={h.id}
                                className="relative grid items-center"
                                style={{ gridTemplateColumns: 'minmax(70px, 90px) 1fr 38px', gap: 12, paddingBottom: i < historyForTimeline.length - 1 ? 12 : 0 }}
                              >
                                <span
                                  className="absolute"
                                  style={{
                                    left: -19, top: 8, width: 14, height: 14, borderRadius: 7,
                                    background: isLatest ? `radial-gradient(circle, ${histB.color}, ${histB.color}88)` : '#FFF8EC',
                                    border: `2px solid ${histB.color}`,
                                    boxShadow: isLatest ? `0 0 0 4px ${histB.color}22` : 'none',
                                  }}
                                />
                                <div className="min-w-0">
                                  <p className="font-heading text-[13px] font-semibold truncate" style={{ color: '#670F22' }}>
                                    {formatHabitDate(h.created_at)}
                                  </p>
                                  {isLatest && (
                                    <p className="text-[9px] font-bold uppercase mt-0.5" style={{ letterSpacing: '0.18em', color: histB.color }}>
                                      ● Reciente
                                    </p>
                                  )}
                                </div>
                                <div className="relative" style={{ height: 6, borderRadius: 3, background: 'rgba(103,15,34,0.06)', overflow: 'hidden' }}>
                                  <div
                                    className="absolute inset-y-0 left-0"
                                    style={{
                                      width: `${pct}%`,
                                      background: `linear-gradient(90deg, ${histB.color}AA, ${histB.color})`,
                                      borderRadius: 3,
                                    }}
                                  />
                                </div>
                                <span
                                  className="font-heading font-semibold tabular-nums text-right"
                                  style={{ color: histB.color, fontSize: 16 }}
                                >
                                  {score.toFixed(1)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SIGUIENTE PASO — derived from first improvement */}
                    {firstImprove && (
                      <div
                        style={{
                          padding: 22,
                          borderRadius: 20,
                          background: 'linear-gradient(135deg, rgba(103,15,34,0.05), rgba(231,200,160,0.12))',
                          border: '1px solid rgba(103,15,34,0.08)',
                        }}
                      >
                        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: '#670F22' }}>
                          El siguiente paso
                        </p>
                        <p className="font-heading text-[15px] font-semibold mt-2 leading-[1.45]" style={{ color: '#670F22' }}>
                          “{firstImprove.hint(latest)}”
                        </p>
                        <p className="text-[11px] mt-2 italic" style={{ color: 'rgba(103,15,34,0.6)' }}>
                          — Plan nutricional · ajusta este hábito esta semana.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

      </div>

      <HabitsFormModal
        open={showHabitsModal}
        onClose={() => setShowHabitsModal(false)}
        initial={latest}
      />
    </section>
  );
}
