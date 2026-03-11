'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAnthropometryStore, type AnthropometryEvaluation } from '@/lib/stores/anthropometryStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

/* ── Color helpers ── */
const CT: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600' };
const CB: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', red: 'bg-red-100' };
const CD: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-amber-500', red: 'bg-red-500' };
const CBorder: Record<string, string> = { green: 'border-green-200', yellow: 'border-amber-200', red: 'border-red-200' };

/* ── Educational content per index ── */
type IndexInfo = {
  title: string;
  whatIs: string;
  result: Record<string, string>;
  action: Record<string, string>;
};

const INDEX_INFO: Record<string, IndexInfo> = {
  bmi: {
    title: 'Tu peso y estatura',
    whatIs: 'El IMC (Índice de Masa Corporal) compara tu peso con tu estatura. Es un primer filtro general — no distingue entre músculo y grasa, pero ayuda a identificar si tu peso está en un rango saludable.',
    result: {
      green: 'Tu peso está dentro del rango saludable. Esto significa que la relación entre tu peso y estatura es adecuada. Sigue así.',
      yellow: 'Tu peso está ligeramente por encima del rango ideal. Esto no significa que estés mal — muchas personas con buena masa muscular caen aquí. Lo importante es complementar con otros indicadores.',
      red: 'Tu peso está en un rango que puede representar un riesgo para tu salud. No te preocupes, con tu programa de entrenamiento y hábitos saludables puedes mejorar progresivamente.',
    },
    action: {
      green: 'Mantén tus hábitos actuales de alimentación y ejercicio. La constancia es tu mejor aliada.',
      yellow: 'Enfócate en tu composición corporal: no se trata solo de peso, sino de cuánto es músculo y cuánto es grasa. Tu entrenador puede ajustar tu programa.',
      red: 'Combina tu entrenamiento con una alimentación consciente. Los cambios pequeños y sostenidos generan los mejores resultados a largo plazo.',
    },
  },
  whr: {
    title: 'Distribución de grasa',
    whatIs: 'La relación cintura-cadera mide cómo se distribuye la grasa en tu cuerpo. Cuando la grasa se acumula más en el abdomen (forma de manzana), puede haber mayor riesgo cardiovascular que cuando se distribuye más en caderas y piernas.',
    result: {
      green: 'Tu grasa se distribuye de forma saludable. Esto es un muy buen indicador para tu salud cardiovascular.',
      yellow: 'Hay una acumulación moderada de grasa en la zona abdominal. Es un área donde vale la pena trabajar, pero no es alarmante.',
      red: 'La distribución de grasa indica concentración abdominal significativa. Esto se asocia con mayor riesgo metabólico, pero es reversible con ejercicio y alimentación adecuada.',
    },
    action: {
      green: 'Sigue con tu rutina de ejercicio. Los entrenamientos que combinan fuerza y cardio ayudan a mantener esta distribución.',
      yellow: 'Ejercicios cardiovasculares y de core pueden ayudar a reducir la grasa abdominal. Tu entrenador puede incluir más trabajo de este tipo.',
      red: 'Prioriza actividad cardiovascular regular y ejercicios de fuerza. La reducción de la cintura es uno de los cambios más positivos que puedes lograr para tu salud.',
    },
  },
  bf: {
    title: 'Tu composición corporal',
    whatIs: 'El porcentaje de grasa indica qué parte de tu peso total es grasa corporal. Es más informativo que el peso solo, porque puedes pesar lo mismo y tener menos grasa si has ganado músculo. Es el indicador más importante de tu recomposición corporal.',
    result: {
      green: 'Tu porcentaje de grasa está en un rango saludable. Esto indica una buena composición corporal.',
      yellow: 'Tu grasa corporal está un poco por encima del rango ideal. Con constancia en tu entrenamiento, puedes mejorar esta proporción.',
      red: 'Tu porcentaje de grasa está elevado. Cada sesión de entrenamiento contribuye a mejorar tu composición corporal — el progreso es gradual pero real.',
    },
    action: {
      green: 'Para mantener o mejorar, combina entrenamientos de fuerza (que aumentan masa muscular) con alimentación balanceada.',
      yellow: 'Enfócate en entrenamientos de fuerza combinados con actividad cardiovascular. La alimentación es clave: no se trata de hacer dieta, sino de nutrir bien tu cuerpo.',
      red: 'Tu entrenador diseñará un programa que priorice la pérdida de grasa manteniendo tu masa muscular. Los hábitos sostenibles son más efectivos que las dietas extremas.',
    },
  },
  waist: {
    title: 'Tu zona abdominal',
    whatIs: 'El perímetro de cintura por sí solo es uno de los indicadores más directos de riesgo metabólico. Una cintura más grande sugiere acumulación de grasa visceral (la grasa que rodea los órganos internos), que es diferente a la grasa que se ve por fuera.',
    result: {
      green: 'Tu cintura está en un rango seguro. La grasa abdominal no representa un riesgo adicional para tu salud.',
      yellow: 'Tu cintura está en una zona de atención. No es crítico, pero reducir unos centímetros mejoraría significativamente tu perfil de salud.',
      red: 'Tu cintura indica acumulación de grasa abdominal que puede afectar tu salud. La buena noticia: la grasa abdominal es de las primeras en responder al ejercicio regular.',
    },
    action: {
      green: 'Mantén tu nivel de actividad física. Los entrenamientos de fuerza y cardio ayudan a prevenir acumulación futura.',
      yellow: 'Incorpora más movimiento en tu día a día además de tus sesiones. Caminar después de comer, por ejemplo, ayuda a reducir la grasa abdominal.',
      red: 'Además de tu entrenamiento, cuida tu alimentación — especialmente el consumo de azúcares y alcohol, que se asocian directamente con grasa abdominal. Cada centímetro que bajes es un logro.',
    },
  },
  mass: {
    title: 'Grasa vs músculo',
    whatIs: 'Tu cuerpo está compuesto por grasa corporal y masa libre de grasa (músculo, hueso, agua, órganos). Lo ideal es que cuando bajes de peso, pierdas grasa y mantengas o aumentes tu masa muscular. Por eso pesarte no basta — lo que importa es qué estás perdiendo.',
    result: {
      green: 'Tu masa libre de grasa se mantiene o crece mientras reduces grasa. Esto es exactamente lo que buscamos: recomposición corporal.',
      yellow: 'Estás en un proceso de cambio. Vigila que tu masa libre de grasa no baje demasiado — eso indicaría que estás perdiendo músculo en vez de grasa.',
      red: 'Es importante ganar masa muscular y reducir grasa. Tu entrenador puede ajustar la intensidad y el tipo de ejercicio para optimizar tu composición.',
    },
    action: {
      green: 'Sigue así. El entrenamiento de fuerza es tu mejor herramienta para mantener y construir masa muscular.',
      yellow: 'Asegúrate de consumir suficiente proteína y no recortar calorías excesivamente. El músculo necesita nutrientes para mantenerse.',
      red: 'Prioriza el entrenamiento de fuerza y una ingesta adecuada de proteína. Tu entrenador puede orientarte sobre la intensidad correcta.',
    },
  },
};

function getDiffBadge(current: number, previous: number, unit: string, inverted = false) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return null;
  const improved = inverted ? diff < 0 : diff > 0;
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${improved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {diff > 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)} {unit}
    </span>
  );
}

function IndexCard({ id, ev, prev }: { id: string; ev: AnthropometryEvaluation; prev: AnthropometryEvaluation | null }) {
  const [open, setOpen] = useState(false);
  const info = INDEX_INFO[id];
  if (!info) return null;

  let value: string | number = '';
  let unit = '';
  let color = 'green';
  let diffEl: React.ReactNode = null;

  if (id === 'bmi') {
    value = ev.bmi; color = ev.bmi_color;
    if (prev) diffEl = getDiffBadge(parseFloat(ev.bmi), parseFloat(prev.bmi), '', true);
  } else if (id === 'whr') {
    value = ev.waist_hip_ratio; color = ev.whr_color;
    if (prev) diffEl = getDiffBadge(parseFloat(ev.waist_hip_ratio), parseFloat(prev.waist_hip_ratio), '', true);
  } else if (id === 'bf') {
    value = ev.body_fat_pct; unit = '%'; color = ev.bf_color;
    if (prev) diffEl = getDiffBadge(parseFloat(ev.body_fat_pct), parseFloat(prev.body_fat_pct), '%', true);
  } else if (id === 'waist') {
    value = ev.waist_cm; unit = ' cm'; color = ev.waist_risk_color;
    if (prev) diffEl = getDiffBadge(parseFloat(ev.waist_cm), parseFloat(prev.waist_cm), 'cm', true);
  } else if (id === 'mass') {
    value = `${ev.fat_mass_kg} / ${ev.lean_mass_kg}`; unit = ' kg'; color = ev.bf_color;
  }

  const colorKey = color || 'green';

  return (
    <div className={`bg-white/70 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden transition-all ${CBorder[colorKey]}`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 p-5 cursor-pointer hover:bg-kore-cream/20 transition-colors text-left">
        <div className={`w-10 h-10 rounded-full ${CB[colorKey]} flex items-center justify-center flex-shrink-0`}>
          <div className={`w-3 h-3 rounded-full ${CD[colorKey]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-kore-gray-dark">{info.title}</p>
          <p className="text-xs text-kore-gray-dark/50 mt-0.5">{id === 'mass' ? 'Grasa y masa libre' : (
            id === 'bmi' ? ev.bmi_category : id === 'whr' ? ev.whr_risk : id === 'bf' ? ev.bf_category : ev.waist_risk
          )}</p>
        </div>
        <div className="flex items-center gap-2">
          {diffEl}
          <span className={`font-heading text-xl font-bold ${CT[colorKey]}`}>{value}<span className="text-xs font-normal">{unit}</span></span>
        </div>
        <svg className={`w-5 h-5 text-kore-gray-dark/30 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 animate-in fade-in duration-200">
          <div className="bg-kore-cream/40 rounded-xl p-4">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1.5">¿Qué significa esto?</p>
            <p className="text-sm text-kore-gray-dark/80 leading-relaxed">{info.whatIs}</p>
          </div>
          <div className={`${CB[colorKey]} rounded-xl p-4`}>
            <p className={`text-xs ${CT[colorKey]} uppercase tracking-wider font-medium mb-1.5`}>Tu resultado</p>
            <p className={`text-sm ${CT[colorKey]}/80 leading-relaxed`}>{info.result[colorKey] || info.result.green}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-kore-gray-light/30">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1.5">¿Qué puedes hacer?</p>
            <p className="text-sm text-kore-gray-dark/70 leading-relaxed">{info.action[colorKey] || info.action.green}</p>
          </div>
        </div>
      )}
    </div>
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
  const first: AnthropometryEvaluation | null = evaluations.length > 1 ? evaluations[evaluations.length - 1] : null;

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16">
        <div data-hero="badge" className="mb-8 xl:mb-10">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu salud</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">Mi Diagnóstico</h1>
          {latest && (
            <p className="text-sm text-kore-gray-dark/50 mt-1">
              Última evaluación: {new Date(latest.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : !latest ? (
          <div data-hero="heading" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/50 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-cream flex items-center justify-center">
              <svg className="w-8 h-8 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Tu diagnóstico está en camino</h2>
            <p className="text-sm text-kore-gray-dark/50 mb-1">Tu entrenador realizará tu primera evaluación corporal.</p>
            <p className="text-xs text-kore-gray-dark/40">Aquí podrás ver cómo evoluciona tu cuerpo a lo largo del tiempo, con explicaciones claras de cada indicador.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ══ Hero summary: 3 key numbers ══ */}
            <div data-hero="heading" className="grid grid-cols-3 gap-3">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm text-center">
                <p className="text-xs text-kore-gray-dark/50 mb-2">Peso actual</p>
                <p className="font-heading text-2xl font-bold text-kore-gray-dark">{latest.weight_kg}<span className="text-sm font-normal ml-1">kg</span></p>
                {first && (
                  <div className="mt-2">{getDiffBadge(parseFloat(latest.weight_kg), parseFloat(first.weight_kg), 'kg desde inicio', true)}</div>
                )}
              </div>
              <div className={`backdrop-blur-sm rounded-2xl p-5 border shadow-sm text-center ${CB[latest.bf_color]} ${CBorder[latest.bf_color]}`}>
                <p className={`text-xs ${CT[latest.bf_color]}/70 mb-2`}>Grasa corporal</p>
                <p className={`font-heading text-2xl font-bold ${CT[latest.bf_color]}`}>{latest.body_fat_pct}<span className="text-sm font-normal ml-1">%</span></p>
                {first && (
                  <div className="mt-2">{getDiffBadge(parseFloat(latest.body_fat_pct), parseFloat(first.body_fat_pct), '% desde inicio', true)}</div>
                )}
              </div>
              <div className="bg-green-50 backdrop-blur-sm rounded-2xl p-5 border border-green-200 shadow-sm text-center">
                <p className="text-xs text-green-700/70 mb-2">Masa muscular</p>
                <p className="font-heading text-2xl font-bold text-green-700">{latest.lean_mass_kg}<span className="text-sm font-normal ml-1">kg</span></p>
                {first && (
                  <div className="mt-2">{getDiffBadge(parseFloat(latest.lean_mass_kg), parseFloat(first.lean_mass_kg), 'kg desde inicio')}</div>
                )}
              </div>
            </div>

            {/* ══ Trainer notes ══ */}
            {latest.notes && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1">Tu entrenador dice</p>
                    <p className="text-sm text-kore-gray-dark/80 leading-relaxed italic">&ldquo;{latest.notes}&rdquo;</p>
                  </div>
                </div>
              </div>
            )}

            {/* ══ Educational index cards ══ */}
            <div>
              <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">Tus indicadores en detalle</p>
              <p className="text-xs text-kore-gray-dark/50 mb-4">Toca cada indicador para entender qué significa y qué puedes hacer.</p>
              <div className="space-y-3">
                <IndexCard id="bf" ev={latest} prev={previous} />
                <IndexCard id="mass" ev={latest} prev={previous} />
                <IndexCard id="bmi" ev={latest} prev={previous} />
                <IndexCard id="waist" ev={latest} prev={previous} />
                <IndexCard id="whr" ev={latest} prev={previous} />
              </div>
            </div>

            {/* ══ Progress timeline ══ */}
            {evaluations.length > 1 && (
              <div data-hero="body" className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-base font-semibold text-kore-gray-dark mb-1">Tu evolución</h2>
                <p className="text-xs text-kore-gray-dark/50 mb-4">Cada evaluación muestra cómo ha cambiado tu cuerpo.</p>
                <div className="space-y-3">
                  {evaluations.map((ev, i) => {
                    const date = new Date(ev.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
                    const isLatest = i === 0;
                    const isFirst = i === evaluations.length - 1;
                    return (
                      <div key={ev.id} className={`flex items-center gap-4 p-3 rounded-xl ${isLatest ? 'bg-kore-red/5 border border-kore-red/20' : 'bg-kore-cream/30'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isLatest ? 'bg-kore-red/10' : 'bg-kore-cream'}`}>
                          <span className={`text-xs font-bold ${isLatest ? 'text-kore-red' : 'text-kore-gray-dark/40'}`}>{evaluations.length - i}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-kore-gray-dark">
                            {date}
                            {isLatest && <span className="text-xs text-kore-red ml-2">Actual</span>}
                            {isFirst && !isLatest && <span className="text-xs text-kore-gray-dark/40 ml-2">Inicio</span>}
                          </p>
                          <div className="flex gap-3 mt-1 text-xs text-kore-gray-dark/50">
                            <span>{ev.weight_kg} kg</span>
                            <span>{ev.body_fat_pct}% grasa</span>
                            <span>{ev.lean_mass_kg} kg masa libre</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
