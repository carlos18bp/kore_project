'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Dumbbell, Flame, PieChart, Ruler, Scale, Triangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAnthropometryStore, type AnthropometryEvaluation } from '@/lib/stores/anthropometryStore';
import TrainerNoteHero from '@/app/components/shared/TrainerNoteHero';

/* ──────────────────────────────────────────────────────────────────────────
 *  Constants
 *  ────────────────────────────────────────────────────────────────────── */

const KORE = {
  red: '#E00000',
  crimson: '#9A0526',
  ruby: '#AB0D2F',
  wineDark: '#670F22',
  rose: '#CD0C36',
  emerald: '#10B981',
  emeraldLight: '#34D399',
  amber: '#F59E0B',
  grayDark: '#333',
};

const PERIMETER_LABELS: Record<string, string> = {
  brazo_relajado: 'Brazo relajado',
  brazo_flexionado: 'Brazo flexionado',
  antebrazo: 'Antebrazo',
  muneca: 'Muñeca',
  pecho: 'Pecho',
  cintura: 'Cintura',
  gluteos: 'Glúteos',
  muslo: 'Muslo',
  pantorrilla: 'Pantorrilla',
  tobillo: 'Tobillo',
};

const ZONE_GROUPS: { id: 'superior' | 'core' | 'inferior'; label: string; bilateral: string[]; single: string[] }[] = [
  { id: 'superior', label: 'Tren superior', bilateral: ['brazo_relajado', 'brazo_flexionado', 'antebrazo', 'muneca'], single: ['pecho'] },
  { id: 'core', label: 'Core', bilateral: [], single: ['cintura', 'gluteos'] },
  { id: 'inferior', label: 'Tren inferior', bilateral: ['muslo', 'pantorrilla', 'tobillo'], single: [] },
];

const INDEX_ICON: Record<string, LucideIcon> = {
  bf: Flame,
  fat_mass: PieChart,
  lean_mass: Dumbbell,
  bmi: Activity,
  waist: Ruler,
  whr: Scale,
  whe: Triangle,
};

/* ── Educational copy per indicator ────────────────────────────────────── */
type IndexInfo = {
  title: string;
  metric: string;
  emoji: string;
  whatIs: string;
  result: Record<string, string>;
  importance: Record<string, string>;
  nextStep: Record<string, string>;
  action: Record<string, string>;
};

const INDEX_INFO: Record<string, IndexInfo> = {
  bf: {
    title: 'Tu composición corporal',
    metric: '% Grasa',
    emoji: '🔥',
    whatIs:
      'El porcentaje de grasa indica qué parte de tu peso total es grasa corporal. Es más informativo que el peso solo, porque puedes pesar lo mismo y tener menos grasa si has ganado músculo. Es el indicador más importante de tu recomposición.',
    result: {
      green: 'Tu porcentaje de grasa está en un rango saludable. Esto indica una buena composición corporal.',
      yellow: 'Tu grasa corporal está un poco por encima del rango ideal. Con constancia en tu entrenamiento, puedes mejorar esta proporción.',
      yellow_low: 'Tu porcentaje de grasa está por debajo del rango saludable. Un nivel muy bajo puede afectar tu energía y funciones hormonales.',
      red: 'Tu porcentaje de grasa está elevado. Cada sesión de entrenamiento contribuye a mejorar tu composición — el progreso es gradual pero real.',
    },
    importance: {
      green: 'Es uno de los indicadores más valiosos de tu proceso. Tener un buen porcentaje de grasa significa que tu cuerpo tiene una composición saludable.',
      yellow: 'Más revelador que el peso solo. Ayuda a ver si tu proceso está mejorando la proporción entre grasa y músculo, que es lo que realmente importa.',
      yellow_low: 'Un mínimo de grasa corporal es necesario para funciones hormonales, protección de órganos y regulación de temperatura.',
      red: 'La composición corporal es el indicador central. Cada mejora aquí se traduce en mejor salud, más energía y mejor rendimiento.',
    },
    nextStep: {
      green: 'Tu entrenador seguirá monitoreando tu composición para asegurar que mantienes o mejoras estos niveles.',
      yellow: 'Tu entrenador ajustará la intensidad y tipo de ejercicio para optimizar tu composición de forma progresiva.',
      yellow_low: 'Tu entrenador monitoreará que tu porcentaje de grasa no siga bajando y ajustará tu programa si es necesario.',
      red: 'Tu entrenador diseñará un programa que priorice la pérdida de grasa manteniendo tu masa muscular.',
    },
    action: {
      green: 'Combina entrenamientos de fuerza (que aumentan masa muscular) con alimentación balanceada.',
      yellow: 'Enfócate en fuerza + cardio. La alimentación es clave: no se trata de hacer dieta, sino de nutrir bien tu cuerpo.',
      yellow_low: 'Asegúrate de tener una alimentación suficiente. El cuerpo necesita un mínimo saludable de grasa.',
      red: 'Combina entrenamiento de fuerza con alimentación consciente. Los hábitos sostenibles son más efectivos que las dietas extremas.',
    },
  },
  fat_mass: {
    title: 'Tu masa grasa',
    metric: 'Masa grasa',
    emoji: '📉',
    whatIs:
      'La masa grasa es la cantidad de kilos de tu cuerpo que corresponden a grasa. Saber cuántos kilos exactos tienes es más concreto que solo ver un porcentaje, porque te permite ver los cambios reales en kilos.',
    result: {
      green: 'Tu masa grasa está en un nivel adecuado. La cantidad de grasa corporal es proporcionada para tu peso.',
      yellow: 'Tu masa grasa está un poco por encima del rango ideal. Con tu programa puedes reducirla de forma progresiva.',
      yellow_low: 'Tu masa grasa está por debajo del rango saludable. Un nivel muy bajo puede afectar tu energía y funciones hormonales.',
      red: 'Tu masa grasa está elevada. Cada kilo que reduzcas mejora tu composición y tu salud.',
    },
    importance: {
      green: 'Una masa grasa adecuada significa que tu cuerpo tiene una buena proporción de tejido graso. Esto se refleja en mejor energía y rendimiento.',
      yellow: 'Reducir la masa grasa sin perder músculo es uno de los objetivos centrales de tu programa.',
      yellow_low: 'Un mínimo de grasa corporal es necesario para funciones vitales.',
      red: 'La masa grasa elevada impacta tu metabolismo, tu energía y tu salud general. Es una área clave de mejora.',
    },
    nextStep: {
      green: 'Tu entrenador seguirá monitoreando que mantengas esta buena proporción.',
      yellow: 'Tu entrenador ajustará tu programa para favorecer la pérdida de grasa manteniendo masa muscular.',
      yellow_low: 'Tu entrenador se asegurará de que tu nivel de grasa no siga bajando y ajustará tu programa según corresponda.',
      red: 'Tu entrenador priorizará la reducción de grasa con un plan personalizado.',
    },
    action: {
      green: 'Sigue con tu entrenamiento de fuerza y alimentación equilibrada.',
      yellow: 'Combina fuerza y cardio con una alimentación consciente. No se trata de dietas, sino de hábitos sostenibles.',
      yellow_low: 'Asegúrate de tener una alimentación suficiente y equilibrada.',
      red: 'El ejercicio regular y la alimentación adecuada son la mejor combinación.',
    },
  },
  lean_mass: {
    title: 'Tu masa muscular',
    metric: 'Masa magra',
    emoji: '💪',
    whatIs:
      'La masa libre de grasa incluye todo lo que NO es grasa: músculo, huesos, agua y órganos. Es el motor de tu cuerpo. Mantenerla o aumentarla mientras reduces grasa es la clave del éxito a largo plazo.',
    result: {
      green: 'Tu masa libre de grasa es adecuada. Tu cuerpo tiene buena estructura muscular y ósea.',
      yellow: 'Tu masa libre de grasa puede mejorar. Ganar músculo mejoraría tu metabolismo y tu fuerza.',
      red: 'Tu masa libre de grasa es baja. Aumentarla es importante para tu salud, metabolismo y protección articular.',
    },
    importance: {
      green: 'Tener buena masa muscular mejora tu metabolismo, protege articulaciones y te da más energía.',
      yellow: 'El músculo es el motor de tu cuerpo. Aumentarlo mejora tu rendimiento, postura y calidad de vida.',
      red: 'Sin masa muscular suficiente, tu metabolismo se ralentiza y tu cuerpo es más vulnerable.',
    },
    nextStep: {
      green: 'Tu entrenador mantendrá el enfoque en fuerza para conservar y mejorar tu masa muscular.',
      yellow: 'Tu entrenador ajustará tu programa para favorecer el aumento de masa muscular con la intensidad adecuada.',
      red: 'Tu entrenador diseñará un plan enfocado en ganar masa muscular de forma progresiva y segura.',
    },
    action: {
      green: 'Sigue con el entrenamiento de fuerza y asegúrate de consumir proteína suficiente.',
      yellow: 'Prioriza el entrenamiento de fuerza y asegura una buena ingesta de proteína.',
      red: 'Entrenamiento de fuerza + proteína adecuada es tu mejor estrategia.',
    },
  },
  bmi: {
    title: 'Tu IMC',
    metric: 'Índice masa corporal',
    emoji: '📊',
    whatIs:
      'El IMC compara tu peso con tu estatura. Es un primer filtro general — no distingue entre músculo y grasa, pero ayuda a identificar si tu peso está en un rango saludable.',
    result: {
      green: 'Tu peso está dentro del rango saludable. La relación entre tu peso y estatura es adecuada.',
      yellow: 'Tu peso está ligeramente por encima del rango ideal. Muchas personas con buena masa muscular caen aquí — lo importante es complementar con otros indicadores.',
      yellow_low: 'Tu peso está por debajo del rango saludable. Puede indicar que necesitas ganar peso de forma saludable.',
      red: 'Tu peso está en un rango que puede representar un riesgo para tu salud. Con tu programa puedes mejorar progresivamente.',
    },
    importance: {
      green: 'Al estar en rango saludable, se convierte en una base sólida para tu proceso.',
      yellow: 'Es un primer filtro. No define por sí solo tu estado completo, por eso se complementa con grasa corporal, cintura y masa libre de grasa.',
      yellow_low: 'Un peso bajo puede afectar tu energía, fuerza y sistema inmune.',
      red: 'Señala un área de atención. Tu entrenador lo analiza junto con otros indicadores para diseñar un plan adecuado.',
    },
    nextStep: {
      green: 'Tu entrenador seguirá monitoreando este indicador junto con tu composición corporal.',
      yellow: 'Tu entrenador tendrá este resultado en cuenta para ajustar tu proceso de forma personalizada.',
      yellow_low: 'Tu entrenador diseñará un programa enfocado en ganar masa muscular.',
      red: 'Tu entrenador usará este dato junto con tu evaluación para definir prioridades.',
    },
    action: {
      green: 'Mantén tus hábitos actuales. La constancia es tu mejor aliada.',
      yellow: 'Enfócate en composición: no se trata solo de peso, sino de cuánto es músculo y cuánto es grasa.',
      yellow_low: 'Prioriza una alimentación suficiente y entrenamientos de fuerza.',
      red: 'Combina entrenamiento con alimentación consciente. Los cambios pequeños y sostenidos generan los mejores resultados.',
    },
  },
  waist: {
    title: 'Tu zona abdominal',
    metric: 'Cintura',
    emoji: '📏',
    whatIs:
      'El perímetro de cintura por sí solo es uno de los indicadores más directos de riesgo metabólico. Una cintura más grande sugiere acumulación de grasa visceral (la que rodea órganos internos).',
    result: {
      green: 'Tu cintura está en un rango seguro. La grasa abdominal no representa un riesgo adicional.',
      yellow: 'Tu cintura está en una zona de atención. Reducir unos centímetros mejoraría tu perfil de salud.',
      red: 'Tu cintura indica acumulación de grasa abdominal. La buena noticia: es de las primeras en responder al ejercicio regular.',
    },
    importance: {
      green: 'Indicador directo de salud metabólica. En rango seguro, tu riesgo de complicaciones se mantiene bajo.',
      yellow: 'Tiene relación directa con la grasa que rodea tus órganos. Mejorarlo tiene impacto real en tu salud.',
      red: 'Uno de los indicadores más importantes de riesgo metabólico. Es prioritario porque afecta tu salud interna.',
    },
    nextStep: {
      green: 'Tu entrenador mantendrá el enfoque actual para prevenir acumulación futura de grasa abdominal.',
      yellow: 'Tu entrenador incluirá estrategias específicas para reducir la cintura de forma progresiva.',
      red: 'Tu entrenador priorizará este indicador. Con ejercicio regular y alimentación adecuada, es de los que más rápido mejoran.',
    },
    action: {
      green: 'Mantén tu nivel de actividad física. Fuerza + cardio previenen acumulación futura.',
      yellow: 'Incorpora más movimiento en tu día a día. Caminar después de comer ayuda a reducir grasa abdominal.',
      red: 'Cuida tu alimentación — especialmente azúcares y alcohol, asociados a grasa abdominal. Cada centímetro cuenta.',
    },
  },
  whr: {
    title: 'Tu proporción cintura-cadera',
    metric: 'ICC',
    emoji: '⚖️',
    whatIs:
      'La relación cintura-cadera mide cómo se distribuye la grasa. Cintura mayor que cadera (forma de "manzana") se asocia a más riesgo cardiovascular que cuando se distribuye más en caderas y piernas.',
    result: {
      green: 'Tu grasa se distribuye de forma saludable. Buen indicador para tu salud cardiovascular.',
      yellow: 'Hay una acumulación moderada de grasa en zona abdominal. Vale la pena trabajar, pero no es alarmante.',
      red: 'Distribución con concentración abdominal significativa. Reversible con ejercicio y alimentación adecuada.',
    },
    importance: {
      green: 'La distribución de grasa es tan importante como la cantidad. Distribución saludable = riesgo bajo.',
      yellow: 'La grasa abdominal tiene más impacto en la salud que la grasa en otras zonas.',
      red: 'La concentración abdominal es uno de los factores más relevantes para tu salud metabólica.',
    },
    nextStep: {
      green: 'Tu entrenador combinará fuerza y cardio para mantener esta buena distribución.',
      yellow: 'Tu entrenador incorporará ejercicios específicos para reducir grasa abdominal de forma progresiva.',
      red: 'Tu entrenador priorizará este indicador. Con constancia, responde rápido al ejercicio.',
    },
    action: {
      green: 'Sigue con tu rutina. Fuerza + cardio mantienen esta distribución.',
      yellow: 'Cardio y core ayudan a reducir grasa abdominal. Tu entrenador puede incluir más trabajo de este tipo.',
      red: 'Prioriza actividad cardiovascular y fuerza. La reducción de cintura es uno de los cambios más positivos.',
    },
  },
  whe: {
    title: 'Tu proporción cintura-altura',
    metric: 'ICE',
    emoji: '📐',
    whatIs:
      'Idealmente, tu cintura debe medir menos de la mitad de tu altura. Es la regla más simple y certera de riesgo cardiometabólico, sin importar tu peso o contextura.',
    result: {
      green: 'Tu relación cintura-estatura está en rango saludable. Riesgo metabólico por grasa abdominal bajo.',
      yellow: 'Tu relación cintura-estatura indica un riesgo moderado. Hay margen para mejorar.',
      red: 'Tu relación cintura-estatura indica riesgo elevado. La grasa abdominal está en un nivel que conviene abordar.',
    },
    importance: {
      green: 'Uno de los indicadores más confiables de riesgo metabólico. Al estar bien, tu perfil de salud interna es favorable.',
      yellow: 'Señala que la grasa abdominal empieza a ser relevante. Mejorarlo reduce riesgos a largo plazo.',
      red: 'Prioritario porque la grasa abdominal afecta directamente tu salud interna, más allá de lo que se ve por fuera.',
    },
    nextStep: {
      green: 'Tu entrenador seguirá monitoreando para mantener tu buen perfil metabólico.',
      yellow: 'Tu entrenador incluirá estrategias para reducir grasa abdominal de forma progresiva.',
      red: 'Tu entrenador priorizará este indicador. Con ejercicio regular y alimentación adecuada, mejora significativamente.',
    },
    action: {
      green: 'Sigue con tu programa. La combinación de fuerza y cardio es ideal.',
      yellow: 'Ejercicio regular y alimentación consciente son la mejor forma de mejorar este indicador.',
      red: 'Combina cardio + fuerza y cuida tu alimentación. Es de los indicadores que más rápido responden.',
    },
  },
};

const INDEX_FORMULAS: Record<string, { formula: string; method?: string; reference: string }> = {
  bf: {
    formula: '% grasa = (495 / densidad) − 450  ·  Densidad por Jackson-Pollock 7 sitios o Deurenberg como fallback',
    method: 'Jackson-Pollock 7 sitios (preferido) / Deurenberg (fallback)',
    reference: 'Jackson & Pollock (1978). Br J Nutr, 40(3). · Deurenberg et al. (1991). Br J Nutr, 65(2).',
  },
  fat_mass: {
    formula: 'masa_grasa (kg) = peso × (% grasa / 100)',
    method: 'Derivada del % de grasa corporal',
    reference: 'Derivado del cálculo de % de grasa.',
  },
  lean_mass: {
    formula: 'masa_libre (kg) = peso − masa_grasa',
    method: 'Derivada',
    reference: 'Derivado del cálculo de % de grasa.',
  },
  bmi: {
    formula: 'IMC = peso (kg) / estatura (m)²',
    method: 'Cálculo directo',
    reference: 'WHO (2000). Obesity: preventing and managing the global epidemic. TR Series 894.',
  },
  waist: {
    formula: 'Perímetro de cintura (cm) — medida directa con cinta a nivel umbilical',
    method: 'Comparado con umbrales OMS según sexo',
    reference: 'WHO (2008). Waist Circumference and Waist–Hip Ratio.',
  },
  whr: {
    formula: 'ICC = perímetro cintura / perímetro cadera',
    method: 'Cálculo directo',
    reference: 'WHO (2008). Waist Circumference and Waist–Hip Ratio.',
  },
  whe: {
    formula: 'ICE = cintura (cm) / estatura (cm)',
    method: 'Cálculo directo',
    reference: 'Ashwell & Hsieh (2005). Waist-to-height ratio as a screening tool.',
  },
};

const INDICATOR_ORDER: string[] = ['bf', 'fat_mass', 'lean_mass', 'bmi', 'waist', 'whr', 'whe'];

/* ──────────────────────────────────────────────────────────────────────────
 *  Helpers
 *  ────────────────────────────────────────────────────────────────────── */

const num = (s: string | null | undefined): number | null => {
  if (s === null || s === undefined || s === '') return null;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : null;
};

function formatDate(iso: string | null | undefined, full = false) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', full
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthYear(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

/* Resolve yellow_low for indicators that distinguish low-vs-high yellow */
function resolveMessageKey(indicatorKey: string, color: string, ev: AnthropometryEvaluation): string {
  if (color !== 'yellow') return color;
  if (indicatorKey === 'bmi' && ev.bmi_category === 'Bajo peso') return 'yellow_low';
  if ((indicatorKey === 'bf' || indicatorKey === 'fat_mass') && ev.bf_category === 'Muy bajo') return 'yellow_low';
  return 'yellow';
}

type IndicatorReading = {
  key: string;
  value: number;
  unit: string;
  decimals: number;
  color: string;
  category: string;
  prevValue: number | null;
  series: number[];
  invertDelta: boolean;
};

function buildIndicators(evaluations: AnthropometryEvaluation[]): IndicatorReading[] {
  if (!evaluations.length) return [];
  const latest = evaluations[0];
  const previous = evaluations[1] ?? null;
  const reverse = (key: keyof AnthropometryEvaluation) =>
    evaluations.slice().reverse().map((e) => num(e[key] as string) ?? 0);

  const out: IndicatorReading[] = [];

  // bf
  const bf = num(latest.body_fat_pct);
  if (bf !== null) out.push({
    key: 'bf', value: bf, unit: '%', decimals: 1,
    color: latest.bf_color || 'green', category: latest.bf_category || '',
    prevValue: num(previous?.body_fat_pct ?? null),
    series: reverse('body_fat_pct'),
    invertDelta: true,
  });

  // fat_mass
  const fm = num(latest.fat_mass_kg);
  if (fm !== null) out.push({
    key: 'fat_mass', value: fm, unit: 'kg', decimals: 1,
    color: latest.bf_color || 'green', category: latest.bf_category || '',
    prevValue: num(previous?.fat_mass_kg ?? null),
    series: reverse('fat_mass_kg'),
    invertDelta: true,
  });

  // lean_mass
  const lm = num(latest.lean_mass_kg);
  if (lm !== null) out.push({
    key: 'lean_mass', value: lm, unit: 'kg', decimals: 1,
    color: 'green', category: 'Saludable',
    prevValue: num(previous?.lean_mass_kg ?? null),
    series: reverse('lean_mass_kg'),
    invertDelta: false,
  });

  // bmi
  const bmi = num(latest.bmi);
  if (bmi !== null) out.push({
    key: 'bmi', value: bmi, unit: '', decimals: 1,
    color: latest.bmi_color || 'green', category: latest.bmi_category || '',
    prevValue: num(previous?.bmi ?? null),
    series: reverse('bmi'),
    invertDelta: true,
  });

  // waist (cm)
  const waist = num(latest.waist_cm);
  if (waist !== null) out.push({
    key: 'waist', value: waist, unit: 'cm', decimals: 1,
    color: latest.waist_risk_color || 'green', category: latest.waist_risk || '',
    prevValue: num(previous?.waist_cm ?? null),
    series: reverse('waist_cm'),
    invertDelta: true,
  });

  // whr
  const whr = num(latest.waist_hip_ratio);
  if (whr !== null) out.push({
    key: 'whr', value: whr, unit: '', decimals: 2,
    color: latest.whr_color || 'green', category: latest.whr_risk || '',
    prevValue: num(previous?.waist_hip_ratio ?? null),
    series: reverse('waist_hip_ratio'),
    invertDelta: true,
  });

  // whe
  const whe = num(latest.waist_height_ratio);
  if (whe !== null) out.push({
    key: 'whe', value: whe, unit: '', decimals: 2,
    color: latest.whe_color || 'green', category: latest.whe_risk || '',
    prevValue: num(previous?.waist_height_ratio ?? null),
    series: reverse('waist_height_ratio'),
    invertDelta: true,
  });

  return out.sort((a, b) => INDICATOR_ORDER.indexOf(a.key) - INDICATOR_ORDER.indexOf(b.key));
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Atom components
 *  ────────────────────────────────────────────────────────────────────── */

function Sparkline({ data, color, w = 80, h = 24 }: { data: number[]; color: string; w?: number; h?: number }) {
  const id = useId().replace(/:/g, '');
  if (data.length < 2) return <span style={{ display: 'inline-block', width: w, height: h }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  const last = data[data.length - 1];
  const lastY = h - ((last - min) / range) * h;
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sk-${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={lastY} r="2.6" fill={color} />
      <circle cx={w} cy={lastY} r="5" fill={color} opacity="0.2" />
    </svg>
  );
}

function Delta({
  now, prev, invert = false, suffix = '', big = false, decimals = 1, dark = false,
}: {
  now: number | null; prev: number | null; invert?: boolean; suffix?: string; big?: boolean; decimals?: number; dark?: boolean;
}) {
  if (now === null || prev === null) return null;
  const diff = now - prev;
  const noChange = Math.abs(diff) < 0.05;
  const improved = invert ? diff < 0 : diff > 0;
  const arrow = noChange ? '–' : diff > 0 ? '↑' : '↓';
  const bg = noChange
    ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(51,51,51,0.06)')
    : improved
    ? 'rgba(52,211,153,0.18)'
    : 'rgba(245,158,11,0.18)';
  const color = noChange
    ? (dark ? 'rgba(255,255,255,0.55)' : 'rgba(51,51,51,0.5)')
    : improved
    ? '#34D399'
    : KORE.amber;
  return (
    <span
      className="inline-flex items-center font-semibold tabular-nums"
      style={{
        gap: 4,
        padding: big ? '4px 10px' : '2px 8px',
        borderRadius: 999,
        background: bg,
        color,
        fontSize: big ? 12 : 11,
      }}
    >
      {arrow} {Math.abs(diff).toFixed(decimals)}{suffix}
    </span>
  );
}

function StatusDot({ color, pulse = true, size = 10 }: { color: string; pulse?: boolean; size?: number }) {
  const hex = color === 'red' ? '#EF4444' : color === 'yellow' || color === 'yellow_low' ? KORE.amber : KORE.emerald;
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: size / 2, background: hex }} />
      {pulse && (
        <span
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: size / 2 + 4,
            background: hex,
            opacity: 0.3,
            animation: 'kore-pulse-dot 2s ease-in-out infinite',
          }}
        />
      )}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Main page
 *  ────────────────────────────────────────────────────────────────────── */

export default function MyDiagnosisPage() {
  const { user } = useAuthStore();
  const { evaluations, loading, fetchMyEvaluations } = useAnthropometryStore();

  const [activeIndicator, setActiveIndicator] = useState<string>('bf');
  const [activeTab, setActiveTab] = useState<'resultado' | 'significa' | 'importancia' | 'siguiente' | 'formula'>('resultado');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ superior: true, core: true, inferior: false });

  useEffect(() => {
    fetchMyEvaluations();
  }, [fetchMyEvaluations]);

  const latest = evaluations[0] ?? null;
  const previous = evaluations[1] ?? null;
  const first = evaluations.length > 1 ? evaluations[evaluations.length - 1] : null;

  const indicators = useMemo(() => buildIndicators(evaluations), [evaluations]);
  const activeReading = indicators.find((i) => i.key === activeIndicator) ?? indicators[0];

  // Hero metrics
  const latestBf = num(latest?.body_fat_pct ?? null);
  const latestWeight = num(latest?.weight_kg ?? null);
  const latestLean = num(latest?.lean_mass_kg ?? null);
  const latestFat = num(latest?.fat_mass_kg ?? null);
  const latestWaist = num(latest?.waist_cm ?? null);
  const firstBf = num(first?.body_fat_pct ?? null);
  const firstWeight = num(first?.weight_kg ?? null);
  const firstLean = num(first?.lean_mass_kg ?? null);
  const firstFat = num(first?.fat_mass_kg ?? null);
  const firstWaist = num(first?.waist_cm ?? null);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  if (loading) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  if (!latest) {
    return (
      <section className="min-h-screen bg-kore-cream">
        <style>{HERO_KEYFRAMES}</style>
        <div className="px-5 xl:px-10 pt-6 xl:pt-10 pb-16 max-w-xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Tu salud</p>
          <h1 className="font-heading text-3xl font-semibold text-kore-wine-dark mt-2">Antropometría</h1>
          <div className="mt-10 bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/60 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-red/10 flex items-center justify-center">
              <span className="text-3xl">📊</span>
            </div>
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Tu diagnóstico está en camino</h2>
            <p className="text-sm text-kore-gray-dark/55">Tu entrenador realizará tu primera evaluación corporal.</p>
            <p className="text-xs text-kore-gray-dark/40 mt-1">Aquí podrás ver cómo evoluciona tu cuerpo a lo largo del tiempo.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-kore-cream">
      <style>{HERO_KEYFRAMES}</style>
      <div className="px-5 xl:px-10 pt-6 xl:pt-10 pb-20 mx-auto" style={{ maxWidth: 1280 }}>

        {/* ── HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Tu salud</p>
            <h1 className="font-heading text-3xl xl:text-4xl font-semibold text-kore-wine-dark mt-2 leading-tight">Antropometría</h1>
            <p className="text-[13px] text-kore-gray-dark/60 mt-1.5">
              Última evaluación · {formatDate(latest.evaluation_date || latest.created_at, true)} · {evaluations.length} {evaluations.length === 1 ? 'sesión' : 'sesiones'} registradas
            </p>
          </div>
          <a
            href="#plan-accion"
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-[12px]"
            style={{
              background: `linear-gradient(135deg, ${KORE.crimson}, ${KORE.ruby})`,
              boxShadow: '0 4px 12px -4px rgba(154,5,38,0.4)',
            }}
          >
            Ver plan de acción
          </a>
        </div>

        {/* ── Notas del trainer */}
        <TrainerNoteHero
          className="mb-6"
          note={latest.notes ?? ''}
          trainerName={latest.trainer_name}
          date={latest.evaluation_date || latest.created_at}
        />

        {/* ══════════════ DARK HERO ══════════════ */}
        {latestBf !== null && latestWeight !== null && (
          <DarkHero
            latestBf={latestBf}
            latestWeight={latestWeight}
            latestLean={latestLean}
            latestFat={latestFat}
            latestWaist={latestWaist}
            firstBf={firstBf}
            firstWeight={firstWeight}
            firstLean={firstLean}
            firstFat={firstFat}
            firstWaist={firstWaist}
            firstDate={first?.evaluation_date || first?.created_at || null}
            latestDate={latest.evaluation_date || latest.created_at || null}
            seriesBf={evaluations.slice().reverse().map((e) => num(e.body_fat_pct) ?? 0)}
            seriesLean={evaluations.slice().reverse().map((e) => num(e.lean_mass_kg) ?? 0)}
            seriesWaist={evaluations.slice().reverse().map((e) => num(e.waist_cm) ?? 0)}
            evalCount={evaluations.length}
          />
        )}

        {/* ══════════════ ASYMMETRIES (only if any) ══════════════ */}
        {latest.asymmetries && Object.keys(latest.asymmetries).length > 0 && (
          <AsymmetryStrip asymmetries={latest.asymmetries} />
        )}

        {/* ══════════════ INDICATORS — pills + tabbed card ══════════════ */}
        {indicators.length > 0 && activeReading && (
          <div className="mt-7">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Indicadores en detalle</p>
            <h2 className="font-heading text-xl xl:text-2xl font-semibold text-kore-wine-dark mt-1.5 mb-4">
              Lo que cada número significa para ti
            </h2>

            {/* pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5 mb-4">
              {indicators.map((r) => {
                const info = INDEX_INFO[r.key];
                const Icon = INDEX_ICON[r.key] ?? Activity;
                const active = r.key === activeIndicator;
                const dotColor = r.color === 'red' ? '#EF4444' : r.color === 'yellow' || r.color === 'yellow_low' ? KORE.amber : KORE.emerald;
                return (
                  <button
                    key={r.key}
                    onClick={() => { setActiveIndicator(r.key); setActiveTab('resultado'); }}
                    className="w-full min-w-0 transition-all"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: active ? '#fff' : 'rgba(255,255,255,0.6)',
                      border: active ? `1px solid ${dotColor}55` : '1px solid rgba(229,229,229,0.6)',
                      boxShadow: active ? `0 6px 18px -8px ${dotColor}99` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="grid place-items-center shrink-0"
                      style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: active ? `${dotColor}14` : 'rgba(102,15,34,0.06)',
                        color: active ? dotColor : KORE.wineDark,
                      }}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="text-left min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-kore-gray-dark/55 truncate">{info.metric}</span>
                      <span className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-heading text-[14px] font-bold text-kore-gray-dark tabular-nums truncate">{r.value.toFixed(r.decimals)}{r.unit}</span>
                        <StatusDot color={r.color} pulse={active} size={8} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <IndicatorCard reading={activeReading} ev={latest} activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        )}

        {/* ══════════════ PERIMETERS ══════════════ */}
        {latest.perimeters && Object.keys(latest.perimeters).length > 0 && (
          <div className="mt-7">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Tus perímetros</p>
            <h2 className="font-heading text-xl xl:text-2xl font-semibold text-kore-wine-dark mt-1.5 mb-4">
              Cómo cambió cada zona del cuerpo
            </h2>
            {ZONE_GROUPS.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                perimeters={latest.perimeters}
                prevPerimeters={previous?.perimeters}
                open={!!openSections[zone.id]}
                onToggle={() => setOpenSections({ ...openSections, [zone.id]: !openSections[zone.id] })}
              />
            ))}
          </div>
        )}

        {/* ══════════════ TIMELINE ══════════════ */}
        {evaluations.length > 1 && (
          <div className="mt-9">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Tu evolución</p>
            <h2 className="font-heading text-xl xl:text-2xl font-semibold text-kore-wine-dark mt-1.5 mb-5">
              Tu camino, una evaluación a la vez
            </h2>
            <Timeline evaluations={evaluations} />
          </div>
        )}

        {/* ══════════════ CTA ══════════════ */}
        <PlanAccionCTA latestBf={latestBf} firstBf={firstBf} />
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Dark hero
 *  ────────────────────────────────────────────────────────────────────── */

const HERO_KEYFRAMES = `
  @keyframes kore-orb-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(40px,-30px); } }
  @keyframes kore-orb-b { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px,30px); } }
  @keyframes kore-pulse-dot { 0%,100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0; } }
  .kore-noscroll::-webkit-scrollbar { display: none; }
  .kore-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
`;

type DarkHeroProps = {
  latestBf: number; latestWeight: number;
  latestLean: number | null; latestFat: number | null; latestWaist: number | null;
  firstBf: number | null; firstWeight: number | null;
  firstLean: number | null; firstFat: number | null; firstWaist: number | null;
  firstDate: string | null; latestDate: string | null;
  seriesBf: number[]; seriesLean: number[]; seriesWaist: number[];
  evalCount: number;
};

function DarkHero({
  latestBf, latestWeight, latestLean, latestFat, latestWaist,
  firstBf, firstWeight, firstLean, firstFat, firstWaist,
  firstDate, latestDate,
  seriesBf, seriesLean, seriesWaist, evalCount,
}: DarkHeroProps) {
  const leanCirc = 2 * Math.PI * 120;
  const fatCirc = 2 * Math.PI * 90;
  const leanOffset = leanCirc * (latestBf / 100);
  const fatOffset = fatCirc * (1 - latestBf / 100);
  const totalWeightDelta = firstWeight !== null ? firstWeight - latestWeight : null;

  const showStory = firstBf !== null && firstLean !== null && firstFat !== null;
  const bfDelta = firstBf !== null ? firstBf - latestBf : null;
  const leanDelta = firstLean !== null && latestLean !== null ? latestLean - firstLean : null;
  const fatDelta = firstFat !== null && latestFat !== null ? firstFat - latestFat : null;

  const status = bfDelta !== null && bfDelta > 1
    ? { label: 'Vas en muy buen camino', color: KORE.emeraldLight, bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.25)' }
    : bfDelta !== null && bfDelta < -1
    ? { label: 'En momento de empuje', color: KORE.amber, bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.25)' }
    : { label: 'Línea base registrada', color: 'rgba(255,255,255,0.7)', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.16)' };

  return (
    <div
      className="relative overflow-hidden rounded-3xl text-white"
      style={{
        background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
        padding: 'clamp(20px, 4vw, 40px)',
        boxShadow: '0 16px 40px -12px rgba(0,0,0,0.45)',
      }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          top: '12%', right: '12%', width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)',
          filter: 'blur(40px)', animation: 'kore-orb-a 9s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '8%', left: '10%', width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)',
          filter: 'blur(45px)', animation: 'kore-orb-b 11s ease-in-out infinite',
        }}
      />

      <div className="relative grid gap-8 xl:gap-14 xl:grid-cols-[340px_1fr] xl:items-center">
        {/* LEFT: composition rings */}
        <div className="flex flex-col items-center xl:items-start">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/50 self-start">
            Composición corporal
          </p>

          <div className="relative mt-3" style={{ width: 280, height: 280, maxWidth: '100%' }}>
            <svg width="280" height="280" style={{ transform: 'rotate(-90deg)', maxWidth: '100%' }}>
              <defs>
                <linearGradient id="kore-lean-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
                <linearGradient id="kore-fat-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FF4040" />
                  <stop offset="100%" stopColor={KORE.crimson} />
                </linearGradient>
              </defs>
              <circle cx="140" cy="140" r="120" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
              <circle
                cx="140" cy="140" r="120"
                fill="none" stroke="url(#kore-lean-grad)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={leanCirc}
                strokeDashoffset={leanOffset}
                style={{ filter: 'drop-shadow(0 0 12px rgba(52,211,153,0.4))', transition: 'stroke-dashoffset 1s ease-out' }}
              />
              <circle cx="140" cy="140" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
              <circle
                cx="140" cy="140" r="90"
                fill="none" stroke="url(#kore-fat-grad)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={fatCirc}
                strokeDashoffset={fatOffset}
                style={{ filter: 'drop-shadow(0 0 12px rgba(255,64,64,0.5))', transition: 'stroke-dashoffset 1s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-white/45">Peso total</span>
              <span className="font-heading font-bold text-white leading-none mt-1" style={{ fontSize: 56 }}>
                {latestWeight.toFixed(1)}
              </span>
              <span className="text-[12px] text-white/50 mt-1">kg</span>
              {totalWeightDelta !== null && Math.abs(totalWeightDelta) >= 0.1 && (
                <span
                  className="mt-2.5 px-3 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    background: totalWeightDelta > 0 ? 'rgba(52,211,153,0.18)' : 'rgba(245,158,11,0.18)',
                    color: totalWeightDelta > 0 ? '#34D399' : KORE.amber,
                  }}
                >
                  {totalWeightDelta > 0 ? '↓' : '↑'} {Math.abs(totalWeightDelta).toFixed(1)} kg total
                </span>
              )}
            </div>
          </div>

          {/* lean / fat boxes */}
          <div className="mt-4 grid grid-cols-2 gap-3 w-full" style={{ maxWidth: 280 }}>
            {latestLean !== null && (
              <div className="px-3.5 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#34D399' }}>● Magra</p>
                <p className="font-heading text-[22px] font-bold text-white mt-1">
                  {latestLean.toFixed(1)} <span className="text-[11px] text-white/50">kg</span>
                </p>
              </div>
            )}
            {latestFat !== null && (
              <div className="px-3.5 py-3 rounded-xl" style={{ background: 'rgba(255,64,64,0.10)', border: '1px solid rgba(255,64,64,0.2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#FF7A7A' }}>● Grasa</p>
                <p className="font-heading text-[22px] font-bold text-white mt-1">
                  {latestFat.toFixed(1)} <span className="text-[11px] text-white/50">kg</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: storytelling + KPIs */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.color }}
            >
              {status.label}
            </span>
            {firstDate && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
              >
                <span style={{ opacity: 0.55 }}>Desde</span>
                <span>{formatMonthYear(firstDate)}</span>
                {latestDate && firstDate !== latestDate && (
                  <>
                    <span style={{ opacity: 0.4 }}>→</span>
                    <span>{formatMonthYear(latestDate)}</span>
                  </>
                )}
              </span>
            )}
          </div>

          {showStory && bfDelta !== null && Math.abs(bfDelta) >= 0.1 ? (
            <h2
              className="font-heading font-semibold mt-4 leading-[1.05]"
              style={{ color: '#FFF8EC', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-0.015em' }}
            >
              {bfDelta > 0 ? 'Bajaste' : 'Subiste'} <span style={{ color: '#E7C8A0' }}>{Math.abs(bfDelta).toFixed(1)} pts</span>
              <br />
              <span style={{ color: 'rgba(255,248,236,0.45)', fontWeight: 500 }}>de grasa corporal.</span>
            </h2>
          ) : (
            <h2
              className="font-heading font-semibold mt-4 leading-[1.05]"
              style={{ color: '#FFF8EC', fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-0.015em' }}
            >
              <span style={{ color: '#E7C8A0' }}>{latestBf.toFixed(1)}%</span> de grasa.
              <br />
              <span style={{ color: 'rgba(255,248,236,0.45)', fontWeight: 500 }}>Tu punto de partida.</span>
            </h2>
          )}

          {showStory && (leanDelta !== null || fatDelta !== null) ? (
            <p className="text-white/70 leading-[1.6] mt-3.5" style={{ fontSize: 14, maxWidth: 460 }}>
              {firstDate && (
                <>Desde tu primera evaluación en <strong className="capitalize" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{formatMonthYear(firstDate)}</strong>, </>
              )}
              {leanDelta !== null && (
                <>tu masa magra <strong style={{ color: leanDelta >= 0 ? '#34D399' : KORE.amber, fontWeight: 600 }}>
                  {leanDelta >= 0 ? '+' : ''}{leanDelta.toFixed(1)} kg
                </strong> </>
              )}
              {leanDelta !== null && fatDelta !== null && 'mientras '}
              {fatDelta !== null && (
                <>tu grasa <strong style={{ color: fatDelta >= 0 ? '#34D399' : '#FF7A7A', fontWeight: 600 }}>
                  {fatDelta >= 0 ? '−' : '+'}{Math.abs(fatDelta).toFixed(1)} kg
                </strong></>
              )}
              . Eso significa que tu cuerpo está cambiando composición — no solo perdiendo peso. Esa es la meta.
            </p>
          ) : (
            <p className="text-white/65 leading-[1.6] mt-3.5" style={{ fontSize: 14, maxWidth: 460 }}>
              {latestDate && (
                <>Esta es tu primera evaluación, registrada en <strong className="capitalize" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{formatMonthYear(latestDate)}</strong>. </>
              )}
              {!latestDate && 'Esta es tu primera evaluación. '}
              A partir de aquí construimos el progreso — cada nueva medición compara contra esta base.
            </p>
          )}

          {/* KPI strip */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiTile
              label="% Grasa" now={latestBf} prev={firstBf} suffix="%" invert decimals={1}
              color="#FF4040" series={seriesBf}
            />
            {latestLean !== null && firstLean !== null && (
              <KpiTile
                label="Masa magra" now={latestLean} prev={firstLean} suffix=" kg" invert={false} decimals={1}
                color="#34D399" series={seriesLean}
              />
            )}
            {latestWaist !== null && firstWaist !== null && (
              <KpiTile
                label="Cintura" now={latestWaist} prev={firstWaist} suffix=" cm" invert decimals={1}
                color={KORE.amber} series={seriesWaist}
              />
            )}
          </div>

          <p className="text-[11px] text-white/40 mt-4 tabular-nums">{evalCount} {evalCount === 1 ? 'evaluación' : 'evaluaciones'} registradas</p>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label, now, prev, suffix, invert, decimals, color, series,
}: {
  label: string; now: number; prev: number | null; suffix: string; invert: boolean; decimals: number; color: string; series: number[];
}) {
  return (
    <div className="px-3.5 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-white/50">{label}</span>
        <Delta now={now} prev={prev} invert={invert} suffix={suffix} decimals={decimals} dark />
      </div>
      <div className="flex items-end justify-between mt-2">
        <span className="font-heading font-bold text-white tabular-nums" style={{ fontSize: 22 }}>
          {now.toFixed(decimals)}<span className="text-[11px] text-white/40 ml-0.5">{suffix.trim()}</span>
        </span>
        <Sparkline data={series} color={color} w={70} h={22} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Asymmetry strip
 *  ────────────────────────────────────────────────────────────────────── */

function AsymmetryStrip({ asymmetries }: { asymmetries: Record<string, { d: number; i: number; diff_pct: number }> }) {
  const entries = Object.entries(asymmetries);
  return (
    <div
      className="mt-4 rounded-2xl bg-white p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4"
      style={{ border: `1px solid ${KORE.amber}33`, boxShadow: '0 2px 8px -4px rgba(245,158,11,0.2)' }}
    >
      <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
        <span className="text-xl">⚠️</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: KORE.amber }}>
          Asimetría detectada
        </p>
        <div className="mt-1 space-y-0.5">
          {entries.map(([key, asym]) => {
            const label = (PERIMETER_LABELS[key] ?? key.replace(/_/g, ' ')).toLowerCase();
            const dominant = asym.d > asym.i ? 'derecho' : 'izquierdo';
            return (
              <p key={key} className="text-[14px] font-semibold text-kore-gray-dark">
                Tu {label} {dominant} mide {asym.diff_pct.toFixed(1)}% más que el otro.
              </p>
            );
          })}
        </div>
        <p className="text-[12px] text-kore-gray-dark/60 mt-1">
          No es preocupante; tu coach incluirá ejercicios unilaterales para equilibrar.
        </p>
      </div>
      <div className="flex items-baseline gap-4 shrink-0">
        <div className="text-center">
          <p className="text-[10px] uppercase font-semibold text-kore-gray-dark/50">Dcha</p>
          <p className="font-heading text-xl font-bold tabular-nums" style={{ color: KORE.amber }}>
            {entries[0][1].d}<span className="text-[10px] text-kore-gray-dark/40">cm</span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase font-semibold text-kore-gray-dark/50">Izda</p>
          <p className="font-heading text-xl font-bold tabular-nums text-kore-gray-dark">
            {entries[0][1].i}<span className="text-[10px] text-kore-gray-dark/40">cm</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Indicator card with tabs
 *  ────────────────────────────────────────────────────────────────────── */

function IndicatorCard({
  reading, ev, activeTab, setActiveTab,
}: {
  reading: IndicatorReading;
  ev: AnthropometryEvaluation;
  activeTab: 'resultado' | 'significa' | 'importancia' | 'siguiente' | 'formula';
  setActiveTab: (t: 'resultado' | 'significa' | 'importancia' | 'siguiente' | 'formula') => void;
}) {
  const info = INDEX_INFO[reading.key];
  const formulaInfo = INDEX_FORMULAS[reading.key];
  const messageKey = resolveMessageKey(reading.key, reading.color, ev);
  const customRec = ev.recommendations?.[reading.key === 'fat_mass' ? 'mass' : reading.key];

  const resultText = customRec?.result || info.result[messageKey] || info.result.green;
  const importanceText = info.importance[messageKey] || info.importance.green;
  const nextStepText = info.nextStep[messageKey] || info.nextStep.green;
  const actionText = customRec?.action || info.action[messageKey] || info.action.green;

  const accent = reading.color === 'red' ? '#EF4444' : reading.color === 'yellow' || reading.color === 'yellow_low' ? KORE.amber : KORE.emerald;
  const dotColor = reading.color === 'red' ? '#EF4444' : reading.color === 'yellow' || reading.color === 'yellow_low' ? KORE.amber : KORE.emerald;

  const tabs: { k: typeof activeTab; l: string }[] = [
    { k: 'resultado', l: 'Tu resultado' },
    { k: 'significa', l: '¿Qué significa?' },
    { k: 'importancia', l: '¿Qué importancia tiene?' },
    { k: 'siguiente', l: '¿Qué sigue?' },
    { k: 'formula', l: '¿Cómo se calcula?' },
  ];

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(229,229,229,0.6)' }}>
      {/* Header */}
      <div className="px-5 md:px-7 pt-5 md:pt-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <StatusDot color={reading.color} />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{ color: dotColor }}
            >
              {reading.category || 'Sin clasificación'}
            </span>
          </div>
          <h3 className="font-heading text-2xl font-semibold text-kore-wine-dark mt-2 leading-tight">
            {info.title}
          </h3>
          <p className="text-[13px] text-kore-gray-dark/65 mt-1 leading-snug max-w-xl">
            {info.metric}
          </p>
        </div>
        <div className="flex items-start gap-5 shrink-0">
          <div className="text-right">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="font-heading font-bold text-kore-gray-dark leading-none" style={{ fontSize: 'clamp(32px, 5vw, 44px)' }}>
                {reading.value.toFixed(reading.decimals)}
              </span>
              <span className="text-[14px] text-kore-gray-dark/40">{reading.unit}</span>
            </div>
            <div className="mt-1.5 flex justify-end">
              <Delta now={reading.value} prev={reading.prevValue} invert={reading.invertDelta} suffix={reading.unit} decimals={reading.decimals} big />
            </div>
          </div>
          {reading.series.length > 1 && (
            <div className="pl-5 hidden md:block" style={{ borderLeft: '1px solid rgba(229,229,229,0.6)' }}>
              <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-kore-gray-dark/45 mb-1.5">
                Tendencia · {reading.series.length} {reading.series.length === 1 ? 'evaluación' : 'evaluaciones'}
              </p>
              <Sparkline data={reading.series} color={accent} w={140} h={32} />
            </div>
          )}
        </div>
      </div>

      {/* tabs */}
      <div
        className="kore-noscroll mt-5 px-5 md:px-7 flex gap-3 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(229,229,229,0.6)' }}
      >
        {tabs.map((t) => {
          const active = activeTab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setActiveTab(t.k)}
              className="shrink-0 cursor-pointer transition-colors text-[12px] font-semibold whitespace-nowrap"
              style={{
                padding: '14px 2px',
                background: 'none',
                border: 'none',
                color: active ? KORE.crimson : 'rgba(51,51,51,0.5)',
                borderBottom: active ? `2px solid ${KORE.crimson}` : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.l}
            </button>
          );
        })}
      </div>

      {/* tab content */}
      <div className="px-5 md:px-7 py-5 md:py-6 min-h-[120px]">
        {activeTab === 'resultado' && (
          <p className="text-[14px] text-kore-gray-dark leading-[1.65]">
            {resultText}
          </p>
        )}
        {activeTab === 'significa' && (
          <p className="text-[14px] text-kore-gray-dark leading-[1.65]">{info.whatIs}</p>
        )}
        {activeTab === 'importancia' && (
          <p className="text-[14px] text-kore-gray-dark leading-[1.65]">{importanceText}</p>
        )}
        {activeTab === 'siguiente' && (
          <div>
            <p className="text-[14px] text-kore-gray-dark leading-[1.65] mb-3">{nextStepText}</p>
            <p className="text-[13px] text-kore-gray-dark/70 leading-[1.6] mb-4">{actionText}</p>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/mi-programa"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-[12px]"
                style={{ background: `linear-gradient(135deg, ${KORE.crimson}, ${KORE.ruby})` }}
              >
                Ver mi programa →
              </Link>
              <Link
                href="/my-nutrition"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[12px]"
                style={{ background: 'rgba(102,15,34,0.06)', color: KORE.wineDark }}
              >
                Ver mi nutrición →
              </Link>
            </div>
          </div>
        )}
        {activeTab === 'formula' && formulaInfo && (
          <div>
            <div
              className="px-4 py-3.5 rounded-xl text-white font-mono text-[13px] leading-[1.55]"
              style={{ background: '#2D0F1A' }}
            >
              {formulaInfo.formula}
            </div>
            {formulaInfo.method && (
              <p className="mt-2.5 text-[12px] text-kore-gray-dark/55">
                Método: <strong className="text-kore-gray-dark">{formulaInfo.method}</strong>
              </p>
            )}
            <p className="mt-1 text-[11px] text-kore-gray-dark/40 italic">{formulaInfo.reference}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Perimeter zone card
 *  ────────────────────────────────────────────────────────────────────── */

type ZoneSpec = { id: 'superior' | 'core' | 'inferior'; label: string; bilateral: string[]; single: string[] };

function ZoneCard({
  zone, perimeters, prevPerimeters, open, onToggle,
}: {
  zone: ZoneSpec;
  perimeters: Record<string, number>;
  prevPerimeters?: Record<string, number>;
  open: boolean;
  onToggle: () => void;
}) {
  type Row = { key: string; label: string; bilateral: boolean; d?: number; i?: number; value?: number; prevD?: number; prevI?: number; prev?: number };
  const rows: Row[] = [];

  for (const k of zone.bilateral) {
    const d = perimeters[`${k}_d`];
    const i = perimeters[`${k}_i`];
    if (d === undefined && i === undefined) continue;
    rows.push({
      key: k, label: PERIMETER_LABELS[k] ?? k, bilateral: true,
      d, i,
      prevD: prevPerimeters?.[`${k}_d`],
      prevI: prevPerimeters?.[`${k}_i`],
    });
  }
  for (const k of zone.single) {
    const v = perimeters[k];
    if (v === undefined) continue;
    rows.push({
      key: k, label: PERIMETER_LABELS[k] ?? k, bilateral: false,
      value: v,
      prev: prevPerimeters?.[k],
    });
  }

  if (!rows.length) return null;

  return (
    <div className="mb-3 bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(229,229,229,0.6)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 md:px-6 py-4 cursor-pointer"
        style={{ background: 'none', border: 'none' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl grid place-items-center font-heading font-bold"
            style={{ background: 'rgba(102,15,34,0.06)', color: KORE.wineDark, fontSize: 14 }}
          >
            {rows.length}
          </div>
          <span className="text-[15px] font-semibold text-kore-gray-dark">{zone.label}</span>
        </div>
        <span
          className="text-kore-gray-dark/40 text-lg transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ›
        </span>
      </button>
      {open && (
        <div className="px-5 md:px-6 pb-5">
          {/* header — desktop only */}
          <div
            className="hidden md:grid gap-3 py-2.5"
            style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr 100px', borderBottom: '1px solid rgba(229,229,229,0.6)' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/50">Zona</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/50 text-right">Derecha</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/50 text-right">Izquierda</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/50 text-right">Promedio</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/50 text-right">Cambio</span>
          </div>

          {rows.map((r) => {
            if (r.bilateral) {
              const d = r.d ?? null;
              const i = r.i ?? null;
              const avg = d !== null && i !== null ? (d + i) / 2 : d ?? i ?? null;
              const prevD = r.prevD ?? null;
              const prevI = r.prevI ?? null;
              const prevAvg = prevD !== null && prevI !== null ? (prevD + prevI) / 2 : null;
              const diff = avg !== null && prevAvg !== null ? avg - prevAvg : null;
              return (
                <div key={r.key} className="md:grid py-3 gap-3 items-center" style={{ borderBottom: '1px solid rgba(229,229,229,0.4)', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 100px' }}>
                  {/* mobile stacked */}
                  <div className="md:hidden flex items-center justify-between mb-1">
                    <span className="text-[14px] font-medium text-kore-gray-dark">{r.label}</span>
                    <PerimeterDeltaBadge diff={diff} />
                  </div>
                  <div className="md:hidden flex items-baseline gap-4">
                    <BilateralCell label="D" value={d} />
                    <BilateralCell label="I" value={i} />
                    <BilateralCell label="Prom." value={avg} highlight />
                  </div>
                  {/* desktop columns */}
                  <span className="hidden md:block text-[13px] font-medium text-kore-gray-dark">{r.label}</span>
                  <span className="hidden md:block font-heading text-[15px] font-semibold text-kore-gray-dark text-right tabular-nums">
                    {d !== null ? d.toFixed(1) : '—'}<span className="text-[10px] text-kore-gray-dark/40 ml-0.5">cm</span>
                  </span>
                  <span className="hidden md:block font-heading text-[15px] font-semibold text-kore-gray-dark text-right tabular-nums">
                    {i !== null ? i.toFixed(1) : '—'}<span className="text-[10px] text-kore-gray-dark/40 ml-0.5">cm</span>
                  </span>
                  <span className="hidden md:block font-heading text-[15px] font-bold text-kore-wine-dark text-right tabular-nums">
                    {avg !== null ? avg.toFixed(1) : '—'}
                  </span>
                  <div className="hidden md:flex justify-end">
                    <PerimeterDeltaBadge diff={diff} />
                  </div>
                </div>
              );
            }
            const v = r.value ?? null;
            const prev = r.prev ?? null;
            const diff = v !== null && prev !== null ? v - prev : null;
            return (
              <div key={r.key} className="md:grid py-3 gap-3 items-center" style={{ borderBottom: '1px solid rgba(229,229,229,0.4)', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 100px' }}>
                <div className="md:hidden flex items-center justify-between mb-1">
                  <span className="text-[14px] font-medium text-kore-gray-dark">{r.label}</span>
                  <PerimeterDeltaBadge diff={diff} />
                </div>
                <div className="md:hidden">
                  <BilateralCell label="Valor" value={v} highlight />
                </div>
                <span className="hidden md:block text-[13px] font-medium text-kore-gray-dark">{r.label}</span>
                <span className="hidden md:block text-[11px] text-kore-gray-dark/40 text-right">—</span>
                <span className="hidden md:block text-[11px] text-kore-gray-dark/40 text-right">—</span>
                <span className="hidden md:block font-heading text-[15px] font-bold text-kore-wine-dark text-right tabular-nums">
                  {v !== null ? v.toFixed(1) : '—'}<span className="text-[10px] text-kore-gray-dark/40 ml-0.5">cm</span>
                </span>
                <div className="hidden md:flex justify-end">
                  <PerimeterDeltaBadge diff={diff} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BilateralCell({ label, value, highlight = false }: { label: string; value: number | null; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-semibold text-kore-gray-dark/50">{label}</p>
      <p
        className={`font-heading ${highlight ? 'text-kore-wine-dark' : 'text-kore-gray-dark'} tabular-nums`}
        style={{ fontSize: 16, fontWeight: highlight ? 700 : 600 }}
      >
        {value !== null ? value.toFixed(1) : '—'}<span className="text-[10px] text-kore-gray-dark/40 ml-0.5">cm</span>
      </p>
    </div>
  );
}

function PerimeterDeltaBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-[11px] text-kore-gray-dark/30 tabular-nums">—</span>;
  const noChange = Math.abs(diff) < 0.05;
  const isImprove = diff < 0; // smaller perimeter = improving
  const bg = noChange ? 'rgba(51,51,51,0.05)' : isImprove ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)';
  const color = noChange ? 'rgba(51,51,51,0.5)' : isImprove ? '#047857' : KORE.amber;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
      style={{ background: bg, color }}
    >
      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Timeline (zigzag desktop, vertical mobile)
 *  ────────────────────────────────────────────────────────────────────── */

function Timeline({ evaluations }: { evaluations: AnthropometryEvaluation[] }) {
  return (
    <div className="relative">
      <div
        className="hidden xl:block absolute top-0 bottom-0"
        style={{ left: '50%', width: 2, transform: 'translateX(-50%)', background: `linear-gradient(180deg, ${KORE.crimson} 0%, rgba(102,15,34,0.2) 100%)` }}
      />
      <div className="xl:hidden absolute top-0 bottom-0" style={{ left: 18, width: 2, background: `linear-gradient(180deg, ${KORE.crimson} 0%, rgba(102,15,34,0.2) 100%)` }} />

      <div className="space-y-5 xl:space-y-6 relative">
        {evaluations.map((ev, i) => {
          const isLeft = i % 2 === 0;
          const isLatest = i === 0;
          const isFirst = i === evaluations.length - 1 && evaluations.length > 1;
          const partial = evaluations.slice(i).reverse().map((e) => num(e.body_fat_pct) ?? 0);
          const wt = num(ev.weight_kg);
          const bf = num(ev.body_fat_pct);
          const ln = num(ev.lean_mass_kg);
          return (
            <div
              key={ev.id}
              className="relative grid xl:grid-cols-[1fr_60px_1fr] grid-cols-[40px_1fr] xl:gap-0 gap-4 items-start xl:items-center"
            >
              {/* mobile dot */}
              <div className="xl:hidden flex items-center justify-center pt-2 relative z-10">
                <span
                  className="rounded-full"
                  style={{
                    width: isLatest ? 18 : 12, height: isLatest ? 18 : 12,
                    background: isLatest ? `linear-gradient(135deg, ${KORE.crimson}, ${KORE.ruby})` : '#fff',
                    border: `3px solid ${isLatest ? '#fff' : KORE.crimson}`,
                    boxShadow: isLatest ? `0 0 0 3px ${KORE.crimson}33` : 'none',
                  }}
                />
              </div>

              {/* card (mobile: span 1 col 2; desktop: zigzag) */}
              <div
                className={`xl:col-span-1 ${isLeft ? 'xl:col-start-1 xl:pr-8 xl:text-right' : 'xl:col-start-3 xl:pl-8 xl:text-left'}`}
              >
                <div
                  className="bg-white rounded-2xl p-4 xl:p-5 inline-block text-left"
                  style={{
                    minWidth: 240,
                    border: isLatest ? `1px solid ${KORE.crimson}33` : '1px solid rgba(229,229,229,0.6)',
                    boxShadow: isLatest ? `0 8px 24px -10px ${KORE.crimson}55` : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-kore-gray-dark/55">
                      {formatDate(ev.evaluation_date || ev.created_at)}
                    </span>
                    {isLatest && (
                      <span
                        className="px-2 py-0.5 rounded-full text-white text-[9px] font-bold uppercase tracking-[0.1em]"
                        style={{ background: `linear-gradient(135deg, ${KORE.crimson}, ${KORE.ruby})` }}
                      >
                        Actual
                      </span>
                    )}
                    {isFirst && !isLatest && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em]"
                        style={{ background: 'rgba(102,15,34,0.08)', color: KORE.wineDark }}
                      >
                        Inicio
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {wt !== null && (
                      <TimelineCell label="Peso" value={wt} unit="kg" />
                    )}
                    {bf !== null && (
                      <TimelineCell label="Grasa" value={bf} unit="%" />
                    )}
                    {ln !== null && (
                      <TimelineCell label="Magra" value={ln} unit="kg" />
                    )}
                  </div>
                  {!isFirst && partial.length > 1 && (
                    <div className="mt-3 pt-3 flex items-center gap-2.5" style={{ borderTop: '1px solid rgba(229,229,229,0.5)' }}>
                      <span className="text-[10px] text-kore-gray-dark/55">Trayectoria grasa →</span>
                      <Sparkline data={partial} color={KORE.crimson} w={100} h={20} />
                    </div>
                  )}
                </div>
              </div>

              {/* desktop dot */}
              <div className="hidden xl:flex justify-center items-center relative z-10" style={{ gridColumn: 2 }}>
                <span
                  className="rounded-full"
                  style={{
                    width: isLatest ? 22 : 14, height: isLatest ? 22 : 14,
                    background: isLatest ? `linear-gradient(135deg, ${KORE.crimson}, ${KORE.ruby})` : '#fff',
                    border: `3px solid ${isLatest ? '#fff' : KORE.crimson}`,
                    boxShadow: isLatest ? `0 0 0 4px ${KORE.crimson}33` : 'none',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineCell({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase font-semibold text-kore-gray-dark/50">{label}</p>
      <p className="font-heading text-[18px] font-bold text-kore-gray-dark mt-0.5 tabular-nums">
        {value.toFixed(1)}<span className="text-[10px] text-kore-gray-dark/40">{unit}</span>
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  CTA — plan de acción
 *  ────────────────────────────────────────────────────────────────────── */

function PlanAccionCTA({ latestBf, firstBf }: { latestBf: number | null; firstBf: number | null }) {
  const improving = latestBf !== null && firstBf !== null && firstBf - latestBf > 1;
  const headline = improving ? 'Vas bien.' : latestBf !== null && firstBf !== null && latestBf - firstBf > 1 ? 'Es momento de empujar.' : 'Línea base lista.';
  const sub = improving ? 'Sigue empujando.' : 'Diseñamos lo que sigue.';

  return (
    <div
      id="plan-accion"
      className="relative overflow-hidden rounded-3xl text-white mt-10 p-6 md:p-8"
      style={{ background: `linear-gradient(135deg, ${KORE.wineDark} 0%, ${KORE.crimson} 100%)` }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          top: -40, right: -40, width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)',
          filter: 'blur(40px)', animation: 'kore-orb-a 9s ease-in-out infinite',
        }}
      />
      <div className="relative flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/60">Tu plan de acción</p>
          <h3 className="font-heading text-3xl md:text-4xl font-semibold mt-2 leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {headline} {sub}
          </h3>
          <p className="text-[14px] text-white/75 mt-3 leading-[1.55]" style={{ maxWidth: 540 }}>
            Tu coach diseñó tu programa y nutrición en base a estos números. Cada semana ajustamos según lo que veamos aquí.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 shrink-0">
          <Link
            href="/mi-programa"
            className="px-5 py-3.5 rounded-xl bg-white font-semibold text-[13px] flex items-center justify-between gap-3 min-w-[240px]"
            style={{ color: KORE.wineDark }}
          >
            Ver mi programa <span>→</span>
          </Link>
          <Link
            href="/my-nutrition"
            className="px-5 py-3.5 rounded-xl text-white font-semibold text-[13px] flex items-center justify-between gap-3"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            Ver mi nutrición <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

