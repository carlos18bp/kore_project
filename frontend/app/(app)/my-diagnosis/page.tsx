'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAnthropometryStore, type AnthropometryEvaluation } from '@/lib/stores/anthropometryStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

gsap.registerPlugin(ScrollTrigger);

/* ── Color helpers ── */
const CT: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600' };
const CB: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', red: 'bg-red-100' };
const CD: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-amber-500', red: 'bg-red-500' };
const CBorder: Record<string, string> = { green: 'border-green-200', yellow: 'border-amber-200', red: 'border-red-200' };

/* ── Scientific basis per index (simplified for clients) ── */
const INDEX_SCIENCE: Record<string, { formula: string; reference: string }> = {
  bmi: {
    formula: 'IMC = peso (kg) / estatura (m)²',
    reference: 'WHO (2000). Obesity: preventing and managing the global epidemic. Technical Report Series 894.',
  },
  whr: {
    formula: 'ICC = perímetro cintura / perímetro cadera',
    reference: 'WHO (2008). Waist Circumference and Waist–Hip Ratio: Report of a WHO Expert Consultation.',
  },
  bf: {
    formula: 'Deurenberg: %Grasa = (1.20 × IMC) + (0.23 × edad) − (10.8 × sexo) − 5.4 · Jackson-Pollock: densidad corporal 7 pliegues + ecuación de Siri',
    reference: 'Deurenberg et al. (1991). Br J Nutr, 65(2). · Jackson & Pollock (1978). Br J Nutr, 40(3).',
  },
  waist: {
    formula: 'Perímetro de cintura (cm) comparado con umbrales OMS',
    reference: 'WHO (2008). Waist Circumference and Waist–Hip Ratio: Report of a WHO Expert Consultation.',
  },
  mass: {
    formula: 'Masa grasa = peso × (%grasa / 100) · Masa libre = peso − masa grasa',
    reference: 'Derivado del cálculo de % de grasa corporal.',
  },
};

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

/* ── Pulse ring CSS color map (Tailwind classes won't animate in GSAP, so use inline) ── */
const RING_HEX: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' };
const DOT_HEX: Record<string, string> = { green: '#16a34a', yellow: '#d97706', red: '#dc2626' };

function IndexCard({ id, ev, prev }: { id: string; ev: AnthropometryEvaluation; prev: AnthropometryEvaluation | null }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
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
    if (!ev.waist_hip_ratio) return null;
    value = ev.waist_hip_ratio; color = ev.whr_color;
    if (prev && prev.waist_hip_ratio) diffEl = getDiffBadge(parseFloat(ev.waist_hip_ratio), parseFloat(prev.waist_hip_ratio), '', true);
  } else if (id === 'bf') {
    value = ev.body_fat_pct; unit = '%'; color = ev.bf_color;
    if (prev) diffEl = getDiffBadge(parseFloat(ev.body_fat_pct), parseFloat(prev.body_fat_pct), '%', true);
  } else if (id === 'waist') {
    if (!ev.waist_cm) return null;
    value = ev.waist_cm; unit = ' cm'; color = ev.waist_risk_color;
    if (prev && prev.waist_cm) diffEl = getDiffBadge(parseFloat(ev.waist_cm), parseFloat(prev.waist_cm), 'cm', true);
  } else if (id === 'mass') {
    value = `${ev.fat_mass_kg} / ${ev.lean_mass_kg}`; unit = ' kg'; color = ev.bf_color;
  }

  const colorKey = color || 'green';
  const science = INDEX_SCIENCE[id];

  const recs = ev.recommendations || {};
  const recKey = id === 'waist' ? 'waist' : id;
  const customRec = recs[recKey];
  const resultText = customRec?.result || info.result[colorKey] || info.result.green;
  const actionText = customRec?.action || info.action[colorKey] || info.action.green;

  // GSAP accordion toggle
  const toggle = useCallback(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    const willOpen = !open;
    setOpen(willOpen);

    if (willOpen) {
      gsap.set(el, { height: 0, opacity: 0, display: 'block', overflow: 'hidden' });
      gsap.to(el, { height: 'auto', opacity: 1, duration: 0.45, ease: 'power3.out' });
      // Stagger inner cards
      const cards = el.querySelectorAll('.idx-panel');
      gsap.fromTo(cards, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.08, delay: 0.12, ease: 'power2.out' });
      // Arrow
      if (arrowRef.current) gsap.to(arrowRef.current, { rotation: 180, duration: 0.3, ease: 'power2.inOut' });
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { gsap.set(el, { display: 'none' }); } });
      if (arrowRef.current) gsap.to(arrowRef.current, { rotation: 0, duration: 0.3, ease: 'power2.inOut' });
    }
  }, [open]);

  // Pulse ring animation
  useEffect(() => {
    if (!ringRef.current) return;
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
    tl.fromTo(ringRef.current,
      { scale: 1, opacity: 0.6 },
      { scale: 2.2, opacity: 0, duration: 1.2, ease: 'power1.out' },
    );
    return () => { tl.kill(); };
  }, []);

  return (
    <div className={`idx-card bg-white/70 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden ${CBorder[colorKey]}`}>
      <button type="button" onClick={toggle} className="w-full flex items-center gap-4 p-5 cursor-pointer hover:bg-kore-cream/20 transition-colors text-left">
        {/* Pulsating dot with ring */}
        <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
          <div className={`absolute inset-0 rounded-full ${CB[colorKey]}`} />
          <div
            ref={ringRef}
            className="absolute rounded-full"
            style={{ width: 12, height: 12, backgroundColor: RING_HEX[colorKey] || RING_HEX.green, opacity: 0.4 }}
          />
          <div
            className="relative w-3 h-3 rounded-full z-10"
            style={{ backgroundColor: DOT_HEX[colorKey] || DOT_HEX.green }}
          />
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
        <svg ref={arrowRef} className="w-5 h-5 text-kore-gray-dark/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div ref={contentRef} style={{ display: 'none', height: 0 }}>
        <div className="px-5 pb-5 space-y-3">
          <div className="idx-panel bg-kore-cream/40 rounded-xl p-4">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1.5">¿Qué significa esto?</p>
            <p className="text-sm text-kore-gray-dark/80 leading-relaxed">{info.whatIs}</p>
          </div>
          <div className={`idx-panel ${CB[colorKey]} rounded-xl p-4`}>
            <p className={`text-xs ${CT[colorKey]} uppercase tracking-wider font-medium mb-1.5`}>Tu resultado</p>
            <p className={`text-sm ${CT[colorKey]}/80 leading-relaxed`}>{resultText}</p>
          </div>
          <div className="idx-panel bg-white rounded-xl p-4 border border-kore-gray-light/30">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1.5">¿Qué puedes hacer?</p>
            <p className="text-sm text-kore-gray-dark/70 leading-relaxed">{actionText}</p>
          </div>
          {science && (
            <div className="idx-panel bg-kore-cream/20 rounded-xl p-4 border border-kore-gray-light/20">
              <p className="text-xs text-kore-gray-dark/40 uppercase tracking-wider font-medium mb-1.5">¿Cómo se calcula?</p>
              <p className="text-xs text-kore-gray-dark/60 leading-relaxed mb-1">{science.formula}</p>
              <p className="text-xs text-kore-gray-dark/40 italic leading-relaxed">{science.reference}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── CountUp number component ── */
function CountUpNumber({ target, decimals = 1, suffix = '' }: { target: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.4,
      delay: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = obj.val.toFixed(decimals) + suffix;
      },
    });
  }, [target, decimals, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

export default function MyDiagnosisPage() {
  const { user } = useAuthStore();
  const { evaluations, loading, fetchMyEvaluations } = useAnthropometryStore();
  const sectionRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchMyEvaluations();
  }, [fetchMyEvaluations]);

  // GSAP: Hero cards entrance with scale + stagger
  useEffect(() => {
    if (!heroRef.current || loading) return;
    const cards = heroRef.current.querySelectorAll('.hero-stat');
    if (!cards.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(cards,
        { y: 30, opacity: 0, scale: 0.92 },
        { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12, delay: 0.15, ease: 'back.out(1.4)' },
      );
    });
    return () => ctx.revert();
  }, [loading, evaluations]);

  // GSAP: Index cards staggered entrance via ScrollTrigger
  useEffect(() => {
    if (!cardsRef.current || loading) return;
    const cards = cardsRef.current.querySelectorAll('.idx-card');
    if (!cards.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(cards,
        { y: 24, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: cardsRef.current, start: 'top 85%', toggleActions: 'play none none none' },
        },
      );
    });
    return () => ctx.revert();
  }, [loading, evaluations]);

  // GSAP: Timeline entries staggered entrance
  useEffect(() => {
    if (!timelineRef.current || loading) return;
    const entries = timelineRef.current.querySelectorAll('.tl-entry');
    if (!entries.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(entries,
        { x: -20, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: 'power2.out',
          scrollTrigger: { trigger: timelineRef.current, start: 'top 85%', toggleActions: 'play none none none' },
        },
      );
    });
    return () => ctx.revert();
  }, [loading, evaluations]);

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
              Última evaluación: {latest.evaluation_date ? new Date(latest.evaluation_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date(latest.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
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
          <div className="space-y-6">
            {/* ══ Hero summary: 3 animated numbers ══ */}
            <div ref={heroRef} className="grid grid-cols-3 gap-3">
              <div className="hero-stat bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm text-center">
                <p className="text-xs text-kore-gray-dark/50 mb-2">Peso actual</p>
                <p className="font-heading text-2xl font-bold text-kore-gray-dark">
                  <CountUpNumber target={parseFloat(latest.weight_kg)} /><span className="text-sm font-normal ml-1">kg</span>
                </p>
                {first && (
                  <div className="mt-2">{getDiffBadge(parseFloat(latest.weight_kg), parseFloat(first.weight_kg), 'kg desde inicio', true)}</div>
                )}
              </div>
              <div className={`hero-stat backdrop-blur-sm rounded-2xl p-5 border shadow-sm text-center ${CB[latest.bf_color]} ${CBorder[latest.bf_color]}`}>
                <p className={`text-xs ${CT[latest.bf_color]}/70 mb-2`}>Grasa corporal</p>
                <p className={`font-heading text-2xl font-bold ${CT[latest.bf_color]}`}>
                  <CountUpNumber target={parseFloat(latest.body_fat_pct)} /><span className="text-sm font-normal ml-1">%</span>
                </p>
                {first && (
                  <div className="mt-2">{getDiffBadge(parseFloat(latest.body_fat_pct), parseFloat(first.body_fat_pct), '% desde inicio', true)}</div>
                )}
              </div>
              <div className="hero-stat bg-green-50 backdrop-blur-sm rounded-2xl p-5 border border-green-200 shadow-sm text-center">
                <p className="text-xs text-green-700/70 mb-2">Masa muscular</p>
                <p className="font-heading text-2xl font-bold text-green-700">
                  <CountUpNumber target={parseFloat(latest.lean_mass_kg)} /><span className="text-sm font-normal ml-1">kg</span>
                </p>
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

            {/* ══ Educational index cards with GSAP stagger ══ */}
            <div>
              <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">Tus indicadores en detalle</p>
              <p className="text-xs text-kore-gray-dark/50 mb-4">Toca cada indicador para entender qué significa y qué puedes hacer.</p>
              <div ref={cardsRef} className="space-y-3">
                <IndexCard id="bf" ev={latest} prev={previous} />
                <IndexCard id="mass" ev={latest} prev={previous} />
                <IndexCard id="bmi" ev={latest} prev={previous} />
                <IndexCard id="waist" ev={latest} prev={previous} />
                <IndexCard id="whr" ev={latest} prev={previous} />
              </div>
            </div>

            {/* ══ Progress timeline with staggered entrance ══ */}
            {evaluations.length > 1 && (
              <div ref={timelineRef} className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-base font-semibold text-kore-gray-dark mb-1">Tu evolución</h2>
                <p className="text-xs text-kore-gray-dark/50 mb-4">Cada evaluación muestra cómo ha cambiado tu cuerpo.</p>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-kore-gray-light/40" />
                  <div className="space-y-3">
                    {evaluations.map((ev, i) => {
                      const date = ev.evaluation_date ? new Date(ev.evaluation_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(ev.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
                      const isLatest = i === 0;
                      const isFirst = i === evaluations.length - 1;
                      return (
                        <div key={ev.id} className={`tl-entry flex items-center gap-4 p-3 rounded-xl relative ${isLatest ? 'bg-kore-red/5 border border-kore-red/20' : 'bg-kore-cream/30'}`}>
                          <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isLatest ? 'bg-kore-red/10' : 'bg-kore-cream'}`}>
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
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
