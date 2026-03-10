'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAnthropometryStore, type AnthropometryEvaluation } from '@/lib/stores/anthropometryStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

const COLOR_BG: Record<string, string> = {
  green: 'bg-green-100', yellow: 'bg-amber-100', red: 'bg-red-100',
};
const COLOR_TEXT: Record<string, string> = {
  green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600',
};
const COLOR_DOT: Record<string, string> = {
  green: 'bg-green-500', yellow: 'bg-amber-500', red: 'bg-red-500',
};

function friendlyMessage(label: string, color: string, category: string): string {
  const messages: Record<string, Record<string, string>> = {
    bmi: {
      green: 'Tu peso está en un rango saludable para tu estatura.',
      yellow: 'Tu peso merece atención. Con constancia puedes mejorar.',
      red: 'Tu peso indica riesgo metabólico. Tu entrenador te acompaña en esto.',
    },
    whr: {
      green: 'Tu distribución de grasa corporal es saludable.',
      yellow: 'La grasa abdominal está algo elevada. Vamos a trabajarlo.',
      red: 'Tu distribución de grasa indica riesgo. Estamos contigo.',
    },
    bf: {
      green: 'Tu porcentaje de grasa está en rango saludable.',
      yellow: 'Tu grasa corporal está algo por encima. La constancia es clave.',
      red: 'Tu grasa corporal está elevada. Cada sesión cuenta.',
    },
    waist: {
      green: 'Tu cintura está en un rango seguro.',
      yellow: 'Tu cintura sugiere riesgo moderado. Trabajemos juntos.',
      red: 'Tu cintura indica riesgo alto. Pero puedes mejorar.',
    },
  };
  return messages[label]?.[color] || category;
}

function ResultRow({ label, title, value, unit, category, color }: {
  label: string; title: string; value: string | number; unit?: string; category: string; color: string;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${COLOR_DOT[color] || COLOR_DOT.green}`} />
      <div className="flex-1">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm font-medium text-kore-gray-dark">{title}</span>
          <span className={`font-heading text-lg font-bold ${COLOR_TEXT[color] || COLOR_TEXT.green}`}>
            {value}{unit && <span className="text-xs font-normal ml-0.5">{unit}</span>}
          </span>
        </div>
        <p className="text-xs text-kore-gray-dark/60">{friendlyMessage(label, color, category)}</p>
      </div>
    </div>
  );
}

function ComparisonBadge({ current, previous, unit, inverted }: {
  current: number; previous: number; unit: string; inverted?: boolean;
}) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return null;
  const improved = inverted ? diff < 0 : diff > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      improved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
    }`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(1)} {unit}
    </span>
  );
}

export default function MyDiagnosisPage() {
  const { user } = useAuthStore();
  const { evaluations, loading, fetchMyEvaluations } = useAnthropometryStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchMyEvaluations();
  }, [fetchMyEvaluations]);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  const latest: AnthropometryEvaluation | null = evaluations[0] || null;
  const previous: AnthropometryEvaluation | null = evaluations[1] || null;

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16">
        <div data-hero="badge" className="mb-8 xl:mb-10">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu salud</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">Mi Diagnóstico</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : !latest ? (
          <div data-hero="heading" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/50 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-cream flex items-center justify-center">
              <svg className="w-8 h-8 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Sin evaluaciones aún</h2>
            <p className="text-sm text-kore-gray-dark/50">Tu entrenador realizará tu primera evaluación antropométrica. Los resultados aparecerán aquí.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Latest evaluation summary */}
            <div data-hero="heading" className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Tu evaluación más reciente</h2>
                <span className="text-xs text-kore-gray-dark/40">
                  {new Date(latest.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              {/* Key metrics */}
              <div className="flex items-center gap-4 mb-5 pb-5 border-b border-kore-gray-light/30">
                <div className="text-center">
                  <p className="text-xs text-kore-gray-dark/50 mb-1">Peso</p>
                  <p className="font-heading text-xl font-bold text-kore-gray-dark">{latest.weight_kg} <span className="text-xs font-normal">kg</span></p>
                  {previous && <ComparisonBadge current={parseFloat(latest.weight_kg)} previous={parseFloat(previous.weight_kg)} unit="kg" inverted />}
                </div>
                <div className="w-px h-12 bg-kore-gray-light/30" />
                <div className="text-center">
                  <p className="text-xs text-kore-gray-dark/50 mb-1">Grasa</p>
                  <p className={`font-heading text-xl font-bold ${COLOR_TEXT[latest.bf_color] || COLOR_TEXT.green}`}>{latest.body_fat_pct}<span className="text-xs font-normal">%</span></p>
                  {previous && <ComparisonBadge current={parseFloat(latest.body_fat_pct)} previous={parseFloat(previous.body_fat_pct)} unit="%" inverted />}
                </div>
                <div className="w-px h-12 bg-kore-gray-light/30" />
                <div className="text-center">
                  <p className="text-xs text-kore-gray-dark/50 mb-1">Masa libre</p>
                  <p className="font-heading text-xl font-bold text-green-700">{latest.lean_mass_kg} <span className="text-xs font-normal">kg</span></p>
                  {previous && <ComparisonBadge current={parseFloat(latest.lean_mass_kg)} previous={parseFloat(previous.lean_mass_kg)} unit="kg" />}
                </div>
              </div>

              {/* Detailed indices */}
              <div className="divide-y divide-kore-gray-light/20">
                <ResultRow label="bmi" title="Índice de Masa Corporal" value={latest.bmi} category={latest.bmi_category} color={latest.bmi_color} />
                <ResultRow label="whr" title="Cintura-Cadera" value={latest.waist_hip_ratio} category={latest.whr_risk} color={latest.whr_color} />
                <ResultRow label="bf" title="Grasa Corporal" value={latest.body_fat_pct} unit="%" category={latest.bf_category} color={latest.bf_color} />
                <ResultRow label="waist" title="Riesgo Abdominal" value={`${latest.waist_cm} cm`} category={latest.waist_risk} color={latest.waist_risk_color} />
              </div>

              {latest.notes && (
                <div className="mt-4 pt-4 border-t border-kore-gray-light/30">
                  <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1">Observaciones del entrenador</p>
                  <p className="text-sm text-kore-gray-dark/70">{latest.notes}</p>
                </div>
              )}
            </div>

            {/* History */}
            {evaluations.length > 1 && (
              <div data-hero="body" className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-base font-semibold text-kore-gray-dark mb-4">Historial</h2>
                <div className="space-y-2">
                  {evaluations.map((ev, i) => (
                    <div key={ev.id} className="flex items-center gap-4 p-2 rounded-lg">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-kore-red' : 'bg-kore-gray-light'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-kore-gray-dark">
                          {new Date(ev.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <p className="text-xs text-kore-gray-dark/50">{ev.weight_kg} kg · {ev.body_fat_pct}% grasa · IMC {ev.bmi}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
