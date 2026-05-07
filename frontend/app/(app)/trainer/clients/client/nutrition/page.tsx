'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useNutritionStore, NutritionHabit } from '@/lib/stores/nutritionStore';
import HeroOrbsCard from '@/app/components/shared/HeroOrbsCard';
import SectionLabel from '@/app/components/shared/SectionLabel';
import EmptyState from '@/app/components/shared/EmptyState';
import ExplainerCard from '@/app/components/shared/ExplainerCard';
import { EVAL_EXPLAINERS } from '@/lib/content/eval-explainers';

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

function TrainerClientNutritionContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId') ?? searchParams.get('id');
  const { entries, loading, error, fetchClientEntries } = useNutritionStore();
  const explainer = EVAL_EXPLAINERS.nutrition;

  useEffect(() => {
    if (clientId) {
      fetchClientEntries(parseInt(clientId));
    }
  }, [clientId, fetchClientEntries]);

  if (!clientId) {
    return <div className="p-8 text-kore-gray-dark/40">Cliente no especificado.</div>;
  }

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto space-y-5">

        <Link
          href={`/trainer/clients/client?id=${clientId}`}
          className="inline-flex items-center gap-1 text-xs text-kore-gray-dark/40 hover:text-kore-red transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Volver al cliente
        </Link>

        <div>
          <SectionLabel className="mb-0.5">{explainer.badge}</SectionLabel>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark">{explainer.heading}</h1>
        </div>

        <HeroOrbsCard radius="2xl">
          <div className="p-6">
            <SectionLabel tone="dark" className="mb-2">{explainer.badge}</SectionLabel>
            <p className="text-white text-base font-semibold leading-snug mb-2">{explainer.heading}</p>
            <p className="text-white/70 text-sm leading-relaxed">{explainer.bodyTrainer}</p>
          </div>
        </HeroOrbsCard>

        <ExplainerCard
          tone="neutral"
          whatIs={explainer.whatIs}
          importance={explainer.importance}
          nextStep={explainer.nextStep}
        />

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <SectionLabel>Historial de hábitos</SectionLabel>

        {loading && entries.length === 0 && (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <EmptyState
            title="Sin evaluaciones de nutrición"
            description="El cliente aún no ha registrado hábitos. Aparecerá aquí cuando los envíe."
          />
        )}

        <div className="space-y-4">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function TrainerClientNutritionPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-kore-gray-dark/40">Cargando...</div>}>
      <TrainerClientNutritionContent />
    </Suspense>
  );
}
