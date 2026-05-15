'use client';

import { useEffect, useState } from 'react';
import { useNutritionStore, type NutritionHabit } from '@/lib/stores/nutritionStore';
import {
  T, FormHero, FormSection, ComputedCard, NotesField, EvalEmptyState, EvalSpinner,
} from './shared';

type HabitTone = 'sage' | 'amber' | 'danger';

type HabitDef = {
  key: keyof NutritionHabit;
  label: string;
  hint: string;
  scale: number;
  getValue: (h: NutritionHabit) => number;
  getLabel: (h: NutritionHabit) => string;
  tone: (h: NutritionHabit) => HabitTone;
};

const HABITS: HabitDef[] = [
  {
    key: 'meals_per_day',
    label: 'Comidas al día',
    hint: 'Recomendado 4–6',
    scale: 6,
    getValue: h => h.meals_per_day,
    getLabel: h => String(h.meals_per_day),
    tone: h => h.meals_per_day >= 4 ? 'sage' : h.meals_per_day >= 3 ? 'amber' : 'danger',
  },
  {
    key: 'water_liters',
    label: 'Agua diaria',
    hint: 'Recomendado 2–3 L',
    scale: 3,
    getValue: h => parseFloat(h.water_liters),
    getLabel: h => `${h.water_liters} L`,
    tone: h => parseFloat(h.water_liters) >= 2 ? 'sage' : parseFloat(h.water_liters) >= 1.5 ? 'amber' : 'danger',
  },
  {
    key: 'fruit_weekly',
    label: 'Frutas por semana',
    hint: 'Ideal 10–14 porciones',
    scale: 14,
    getValue: h => h.fruit_weekly,
    getLabel: h => `${h.fruit_weekly} veces`,
    tone: h => h.fruit_weekly >= 10 ? 'sage' : h.fruit_weekly >= 6 ? 'amber' : 'danger',
  },
  {
    key: 'vegetable_weekly',
    label: 'Verduras por semana',
    hint: 'Ideal 10–14 porciones',
    scale: 14,
    getValue: h => h.vegetable_weekly,
    getLabel: h => `${h.vegetable_weekly} veces`,
    tone: h => h.vegetable_weekly >= 10 ? 'sage' : h.vegetable_weekly >= 6 ? 'amber' : 'danger',
  },
  {
    key: 'protein_frequency',
    label: 'Frecuencia de proteína',
    hint: '1 = nunca · 5 = en cada comida',
    scale: 5,
    getValue: h => h.protein_frequency,
    getLabel: h => `${h.protein_frequency} / 5`,
    tone: h => h.protein_frequency >= 4 ? 'sage' : h.protein_frequency >= 3 ? 'amber' : 'danger',
  },
  {
    key: 'ultraprocessed_weekly',
    label: 'Ultraprocesados por semana',
    hint: 'Ideal ≤ 3 veces',
    scale: 10,
    getValue: h => h.ultraprocessed_weekly,
    getLabel: h => `${h.ultraprocessed_weekly} veces`,
    tone: h => h.ultraprocessed_weekly <= 3 ? 'sage' : h.ultraprocessed_weekly <= 6 ? 'amber' : 'danger',
  },
  {
    key: 'sugary_drinks_weekly',
    label: 'Bebidas azucaradas por semana',
    hint: 'Ideal 0–1 veces',
    scale: 10,
    getValue: h => h.sugary_drinks_weekly,
    getLabel: h => `${h.sugary_drinks_weekly} veces`,
    tone: h => h.sugary_drinks_weekly <= 1 ? 'sage' : h.sugary_drinks_weekly <= 4 ? 'amber' : 'danger',
  },
  {
    key: 'eats_breakfast',
    label: '¿Desayuna habitualmente?',
    hint: '',
    scale: 1,
    getValue: h => h.eats_breakfast ? 1 : 0,
    getLabel: h => h.eats_breakfast ? 'Sí' : 'No',
    tone: h => h.eats_breakfast ? 'sage' : 'amber',
  },
];

const TONE_CFG: Record<HabitTone, { fg: string; bg: string }> = {
  sage:   { fg: T.sageDeep,  bg: 'rgba(168,194,156,0.22)' },
  amber:  { fg: T.amberDeep, bg: 'rgba(229,201,122,0.26)' },
  danger: { fg: '#9A0526',   bg: 'rgba(154,5,38,0.16)' },
};

function HabitRow({ def, habit }: { def: HabitDef; habit: NutritionHabit }) {
  const tone = def.tone(habit);
  const cfg = TONE_CFG[tone];
  const rawVal = def.getValue(habit);
  const pct = Math.min(100, (rawVal / def.scale) * 100);

  return (
    <div style={{ padding: '14px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600, color: T.textDark }}>
            {def.label}
          </div>
          {def.hint && (
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft, marginTop: 1 }}>
              {def.hint}
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 600, color: cfg.fg }}>
          {def.getLabel(habit)}
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(103,15,34,0.06)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: cfg.bg, borderRight: `2px solid ${cfg.fg}`,
          transition: 'width 0.7s ease-out',
        }} />
      </div>
    </div>
  );
}

function habitColor(color: string) {
  if (color === 'green') return 'sage' as const;
  if (color === 'red') return 'danger' as const;
  return 'amber' as const;
}

// ─── Approval Card ────────────────────────────────────────────
function ApprovalCard({ clientId, habit }: { clientId: number; habit: NutritionHabit }) {
  const { approveEntry, entries } = useNutritionStore();
  const [approving, setApproving] = useState(false);
  const [done, setDone] = useState(false);

  const current = entries.find(e => e.id === habit.id) ?? habit;
  const isApproved = !!current.trainer_approved_at;

  const approvedAt = isApproved
    ? new Date(current.trainer_approved_at!).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  async function handleApprove() {
    if (approving || isApproved) return;
    setApproving(true);
    await approveEntry(clientId, habit.id, current.trainer_notes ?? '');
    setApproving(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden',
      background: `linear-gradient(135deg, ${T.wineDeep} 0%, ${T.wineDeep2} 55%, #5C2030 100%)`,
      padding: '20px 22px', marginBottom: 18,
      boxShadow: '0 8px 32px -12px rgba(45,15,26,0.40)',
    }}>
      {/* Status pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(231,200,160,0.65)' }}>
          Revisión del entrenador
        </div>
        <div style={{
          padding: '3px 12px', borderRadius: 999,
          fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
          background: isApproved ? 'rgba(168,194,156,0.22)' : 'rgba(229,201,122,0.18)',
          color: isApproved ? T.sage : T.amber,
          border: isApproved ? '1px solid rgba(168,194,156,0.30)' : '1px solid rgba(229,201,122,0.25)',
        }}>
          {isApproved ? `✓ Aprobado · ${approvedAt}` : 'Pendiente de aprobación'}
        </div>
      </div>

      {current.trainer_notes && (
        <div style={{ marginBottom: isApproved ? 0 : 14 }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 600, color: 'rgba(231,200,160,0.55)', marginBottom: 6 }}>
            {isApproved ? 'Notas enviadas al cliente' : 'Nota actual del entrenador'}
          </div>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.ivory, lineHeight: 1.55, margin: 0 }}>
            {current.trainer_notes}
          </p>
        </div>
      )}

      {!isApproved && (
        <>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(255,248,236,0.55)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Para editar las notas del entrenador, ve a la tab <strong style={{ color: T.champagne }}>Notas → Diario → Hábitos nutricionales</strong>.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleApprove}
              disabled={approving}
              style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '8px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: done ? 'rgba(168,194,156,0.28)' : 'rgba(231,200,160,0.18)',
                color: done ? T.sage : T.champagne,
                transition: 'all 0.2s',
              }}
            >
              {approving ? 'Aprobando…' : done ? '✓ Aprobado' : 'Aprobar evaluación'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function HabitView({ habit }: { habit: NutritionHabit }) {
  const lastEvalLabel = new Date(habit.created_at).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div>
      <FormHero
        kicker="Evaluación · Módulo 5"
        title="Hábito nutricional"
        lastEval={lastEvalLabel}
        role="cliente"
        score={habit.habit_score ? parseFloat(habit.habit_score).toFixed(1) : null}
        scoreLabel="Score · sobre 10"
        scoreTone={habit.habit_score ? habitColor(habit.habit_color) : 'sage'}
      />

      <FormSection title="Resultado auto-calculado" columns={3} gap={12}>
        <ComputedCard
          label="Score hábito"
          value={habit.habit_score ? `${parseFloat(habit.habit_score).toFixed(1)} / 10` : '—'}
          sub="sobre 10"
          tone={habit.habit_score ? habitColor(habit.habit_color) : 'sage'}
        />
        <ComputedCard
          label="Categoría"
          value={habit.habit_category || '—'}
          tone={habit.habit_score ? habitColor(habit.habit_color) : 'sage'}
        />
        <ComputedCard
          label="Última actualización"
          value={lastEvalLabel}
          sub="Completado por cliente"
          tone="wine"
        />
      </FormSection>

      <div style={{
        background: 'rgba(255,255,255,0.70)', borderRadius: 22,
        border: `1px solid ${T.borderSoft}`, padding: '20px 22px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine }}>
            Hábitos reportados
          </div>
          <span style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textSoft,
          }}>Solo lectura · cliente</span>
        </div>
        {HABITS.map(def => (
          <HabitRow key={String(def.key)} def={def} habit={habit} />
        ))}
      </div>

      {habit.notes && (
        <NotesField label="Notas del cliente" value={habit.notes} readonly />
      )}
    </div>
  );
}

export default function EvalNutriTab({ clientId }: { clientId: number }) {
  const { entries, loading, fetchClientEntries } = useNutritionStore();

  useEffect(() => {
    if (clientId) fetchClientEntries(clientId);
  }, [clientId, fetchClientEntries]);

  const latest = entries[0] ?? null;

  if (loading) return <EvalSpinner />;

  if (!latest) {
    return (
      <>
        <FormHero
          kicker="Evaluación · Módulo 5"
          title="Hábito nutricional"
          lastEval={null}
          role="cliente"
        />
        <EvalEmptyState message="Sin evaluaciones de hábito nutricional completadas por el cliente." />
      </>
    );
  }

  return (
    <>
      <ApprovalCard clientId={clientId} habit={latest} />
      <HabitView habit={latest} />
    </>
  );
}
