'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  usePhysicalEvaluationStore,
  type PhysicalEvaluation,
} from '@/lib/stores/physicalEvaluationStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

gsap.registerPlugin(ScrollTrigger);

/* ── Color helpers ── */
const CT: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600' };
const CB: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', red: 'bg-red-100' };
const CBorder: Record<string, string> = { green: 'border-green-200', yellow: 'border-amber-200', red: 'border-red-200' };
const RING_HEX: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' };
const DOT_HEX: Record<string, string> = { green: '#16a34a', yellow: '#d97706', red: '#dc2626' };

/* ── Index info ── */
type IndexInfo = {
  title: string;
  whatIs: string;
  tests: string;
  result: Record<string, string>;
  importance: Record<string, string>;
  nextStep: Record<string, string>;
  action: Record<string, string>;
};

const INDEX_INFO: Record<string, IndexInfo> = {
  general: {
    title: 'Tu condición física general',
    whatIs: 'El índice general evalúa tu capacidad funcional completa: fuerza, resistencia, movilidad y equilibrio. Es el promedio de los cuatro componentes y te da una foto integral de cómo está tu cuerpo para moverse, rendir y sostenerse.',
    tests: 'Promedio de los índices de fuerza, resistencia, movilidad y equilibrio.',
    result: {
      green: 'Tu condición física general es adecuada. Tu cuerpo responde bien al esfuerzo.',
      yellow: 'Tu condición física general está por debajo del rango ideal. Hay áreas por mejorar.',
      red: 'Tu condición física general necesita atención prioritaria.',
    },
    importance: {
      green: 'Tu condición física es la base de todo tu entrenamiento. Al estar en buen nivel, puedes progresar con confianza.',
      yellow: 'Este índice resume cómo está tu cuerpo para moverse y rendir. Mejorarlo impacta directamente tu calidad de vida.',
      red: 'La condición física general es el punto de partida de tu proceso. Cada mejora aquí se traduce en más energía y menos riesgo.',
    },
    nextStep: {
      green: 'Tu entrenador seguirá progresando tu programa para mantener y optimizar tu buen nivel.',
      yellow: 'Tu entrenador identificará los componentes más débiles y ajustará tu programa para fortalecerlos.',
      red: 'Tu entrenador diseñará un plan progresivo y seguro enfocado en mejorar tu base funcional.',
    },
    action: {
      green: 'Sigue con tu programa. La constancia y la progresión gradual son tu mejor estrategia.',
      yellow: 'Tu entrenador ajustará tu programa para fortalecer los componentes más débiles.',
      red: 'El programa se enfocará en mejorar tu base funcional de forma progresiva y segura.',
    },
  },
  strength: {
    title: 'Fuerza',
    whatIs: 'El índice de fuerza evalúa la capacidad de tus músculos para sostener esfuerzos repetidos o mantener posiciones. Se calcula a partir de tres pruebas: sentadillas (tren inferior), flexiones (tren superior) y plancha (core).',
    tests: 'Sentadillas en 1 minuto, flexiones y plancha abdominal.',
    result: {
      green: 'Tu fuerza-resistencia es funcional. Puedes sostener esfuerzos musculares con buen control.',
      yellow: 'Tu fuerza-resistencia está por debajo del promedio para tu grupo.',
      red: 'Tu fuerza-resistencia necesita desarrollo prioritario.',
    },
    importance: {
      green: 'La fuerza es fundamental para proteger articulaciones, mejorar postura y mantener la masa muscular.',
      yellow: 'La fuerza es la base del movimiento seguro. Mejorarla te permite entrenar con más seguridad y eficiencia.',
      red: 'Sin una base de fuerza adecuada, otros componentes se ven limitados. Es la prioridad para tu progreso.',
    },
    nextStep: {
      green: 'Tu entrenador progresará la carga e intensidad de tu entrenamiento de fuerza.',
      yellow: 'Tu entrenador incorporará más trabajo de fuerza funcional adaptado a tu nivel.',
      red: 'Tu entrenador empezará con ejercicios básicos de fuerza con cargas adaptadas a tu nivel actual.',
    },
    action: {
      green: 'Mantén el entrenamiento de fuerza. La progresión en carga e intensidad es tu próximo paso.',
      yellow: 'Incorpora más trabajo de fuerza funcional. Tu entrenador adaptará los ejercicios a tu nivel.',
      red: 'Empezarás con ejercicios básicos de fuerza con cargas adaptadas.',
    },
  },
  endurance: {
    title: 'Resistencia',
    whatIs: 'El índice de resistencia mide tu capacidad aeróbica funcional — qué tan bien puede tu cuerpo mantener un esfuerzo sostenido. Se evalúa con la caminata de 6 minutos, un test usado mundialmente en medicina funcional y rehabilitación.',
    tests: 'Caminata de 6 minutos (distancia en metros).',
    result: {
      green: 'Tu capacidad aeróbica es buena. Toleras el esfuerzo sostenido de forma adecuada.',
      yellow: 'Tu capacidad aeróbica está por debajo del rango esperado.',
      red: 'Tu capacidad aeróbica necesita mejora significativa.',
    },
    importance: {
      green: 'La resistencia te permite sostener esfuerzos prolongados y recuperarte más rápido entre ejercicios.',
      yellow: 'Tu resistencia afecta cuánto puedes rendir en cada sesión. Mejorarla potencia todo tu entrenamiento.',
      red: 'La resistencia es la base para tolerar el esfuerzo. Mejorarla es clave para que puedas progresar en tu programa.',
    },
    nextStep: {
      green: 'Tu entrenador progresará tu actividad cardiovascular en intensidad o duración.',
      yellow: 'Tu entrenador incorporará más actividad cardiovascular adaptada a tu capacidad.',
      red: 'Tu entrenador comenzará con actividad cardiovascular de baja intensidad, aumentando gradualmente.',
    },
    action: {
      green: 'Mantén la actividad cardiovascular regular. Puedes progresar en intensidad o duración.',
      yellow: 'Incorpora más actividad cardiovascular: caminatas, bicicleta o natación.',
      red: 'Empezarás con actividad cardiovascular de baja intensidad, aumentando gradualmente.',
    },
  },
  mobility: {
    title: 'Movilidad',
    whatIs: 'La movilidad evalúa los rangos de movimiento funcionales de tres zonas clave: cadera, hombros y tobillo. Una buena movilidad permite entrenar con seguridad, protege articulaciones y mejora la calidad de movimiento.',
    tests: 'Evaluación de cadera, hombros y tobillo (1–5 cada una).',
    result: {
      green: 'Tu movilidad articular es funcional. Tus rangos de movimiento son adecuados.',
      yellow: 'Algunas zonas articulares presentan limitaciones leves de movilidad.',
      red: 'Hay limitaciones importantes de movilidad que pueden afectar tu movimiento.',
    },
    importance: {
      green: 'La movilidad te permite ejecutar ejercicios con técnica correcta y sin riesgo de lesión.',
      yellow: 'Las limitaciones de movilidad afectan la calidad de tus ejercicios y pueden generar compensaciones.',
      red: 'Sin movilidad adecuada, no es seguro progresar en carga. Es una prioridad para tu protección articular.',
    },
    nextStep: {
      green: 'Tu entrenador mantendrá tu rutina de movilidad como parte integral de tu programa.',
      yellow: 'Tu entrenador incluirá ejercicios específicos de movilidad para las zonas que necesitan mejorar.',
      red: 'Tu entrenador priorizará la movilidad en tu programa antes de progresar en carga.',
    },
    action: {
      green: 'Mantén tu rutina de movilidad. Estiramientos dinámicos antes del entrenamiento son ideales.',
      yellow: 'Tu programa incluirá ejercicios específicos de movilidad para las zonas limitadas.',
      red: 'La movilidad será una prioridad en tu programa antes de progresar en carga.',
    },
  },
  balance: {
    title: 'Equilibrio',
    whatIs: 'El equilibrio mide tu control neuromuscular y estabilidad sobre un solo pie. Es un predictor importante de riesgo de caída y refleja la capacidad de tu sistema nervioso para mantener el control del cuerpo.',
    tests: 'Apoyo unipodal (tiempo en segundos).',
    result: {
      green: 'Tu equilibrio y control neuromuscular son adecuados.',
      yellow: 'Tu equilibrio está por debajo del promedio esperado.',
      red: 'Tu equilibrio necesita atención prioritaria.',
    },
    importance: {
      green: 'El equilibrio refleja la calidad de tu control corporal. Un buen equilibrio protege contra caídas y lesiones.',
      yellow: 'El equilibrio afecta tu estabilidad en ejercicios unilaterales y tu control durante el movimiento.',
      red: 'Sin equilibrio adecuado, el riesgo de caída y lesión aumenta. Es fundamental mejorarlo para tu seguridad.',
    },
    nextStep: {
      green: 'Tu entrenador seguirá incluyendo trabajo de estabilidad y ejercicios unilaterales en tu programa.',
      yellow: 'Tu entrenador incorporará ejercicios específicos de equilibrio en tu plan.',
      red: 'Tu entrenador incluirá trabajo progresivo de equilibrio estático y dinámico como prioridad.',
    },
    action: {
      green: 'Sigue trabajando la estabilidad. Ejercicios unilaterales y superficies inestables son buenas opciones.',
      yellow: 'Incorpora ejercicios de equilibrio: apoyo unipodal, tandem stance, ejercicios con ojos cerrados.',
      red: 'Tu programa incluirá trabajo progresivo de equilibrio estático y dinámico.',
    },
  },
};

/* ── Scientific basis ── */
const SCIENCE = [
  { formula: 'Baremos ajustados por edad (18–35, 36–50, 51–65, 66+) y sexo para cada test.', reference: 'ACSM (2021). Guidelines for Exercise Testing and Prescription, 11th ed.' },
  { formula: 'Fuerza = promedio(sentadillas, flexiones, plancha). Resistencia = caminata 6min. Movilidad = promedio(cadera, hombros, tobillo). Equilibrio = apoyo unipodal.', reference: 'Heyward & Gibson (2014). Advanced Fitness Assessment. Rikli & Jones (2001). Senior Fitness Test Manual.' },
  { formula: '1.0–1.9 Muy bajo · 2.0–2.9 Bajo · 3.0–3.9 Intermedio · 4.0–4.5 Bueno · 4.6–5.0 Muy bueno', reference: 'McGill (2015); Springer et al. (2007); ATS (2002); Enright & Sherrill (1998).' },
];

/* ── Test labels for individual scores ── */
const TEST_LABELS: { key: string; label: string; rawKey: keyof PhysicalEvaluation; scoreKey: keyof PhysicalEvaluation; unit: string }[] = [
  { key: 'squats', label: 'Sentadillas', rawKey: 'squats_reps', scoreKey: 'squats_score', unit: 'reps' },
  { key: 'pushups', label: 'Flexiones', rawKey: 'pushups_reps', scoreKey: 'pushups_score', unit: 'reps' },
  { key: 'plank', label: 'Plancha', rawKey: 'plank_seconds', scoreKey: 'plank_score', unit: 'seg' },
  { key: 'walk', label: 'Caminata 6min', rawKey: 'walk_meters', scoreKey: 'walk_score', unit: 'm' },
  { key: 'unipodal', label: 'Apoyo unipodal', rawKey: 'unipodal_seconds', scoreKey: 'unipodal_score', unit: 'seg' },
];

/* ── CountUp ── */
function CountUpNumber({ target, decimals = 2 }: { target: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target, duration: 1.4, delay: 0.3, ease: 'power2.out',
      onUpdate: () => { if (ref.current) ref.current.textContent = obj.val.toFixed(decimals); },
    });
  }, [target, decimals]);
  return <span ref={ref}>0</span>;
}

/* ── Index card with accordion ── */
function IndexCard({ id, ev }: { id: string; ev: PhysicalEvaluation }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const info = INDEX_INFO[id];
  if (!info) return null;

  const indexKey = id === 'general' ? 'general_index' : `${id}_index`;
  const catKey = id === 'general' ? 'general_category' : `${id}_category`;
  const colKey = id === 'general' ? 'general_color' : `${id}_color`;

  const value = String((ev as unknown as Record<string, unknown>)[indexKey] ?? '0');
  const category = String((ev as unknown as Record<string, unknown>)[catKey] ?? '');
  const color = String((ev as unknown as Record<string, unknown>)[colKey] ?? 'green');

  const recs = ev.recommendations || {};
  const customRec = recs[id];
  const resultText = customRec?.result || info.result[color] || info.result.green;
  const importanceText = info.importance[color] || info.importance.green;
  const nextStepText = info.nextStep[color] || info.nextStep.green;
  const actionText = customRec?.action || info.action[color] || info.action.green;

  const toggle = useCallback(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      gsap.set(el, { height: 0, opacity: 0, display: 'block', overflow: 'hidden' });
      gsap.to(el, { height: 'auto', opacity: 1, duration: 0.45, ease: 'power3.out' });
      const cards = el.querySelectorAll('.idx-panel');
      gsap.fromTo(cards, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.08, delay: 0.12, ease: 'power2.out' });
      if (arrowRef.current) gsap.to(arrowRef.current, { rotation: 180, duration: 0.3, ease: 'power2.inOut' });
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { gsap.set(el, { display: 'none' }); } });
      if (arrowRef.current) gsap.to(arrowRef.current, { rotation: 0, duration: 0.3, ease: 'power2.inOut' });
    }
  }, [open]);

  useEffect(() => {
    if (!ringRef.current) return;
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
    tl.fromTo(ringRef.current, { scale: 1, opacity: 0.6 }, { scale: 2.2, opacity: 0, duration: 1.2, ease: 'power1.out' });
    return () => { tl.kill(); };
  }, []);

  return (
    <div className={`idx-card bg-white/70 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden ${CBorder[color]}`}>
      <button type="button" onClick={toggle} className="w-full flex items-center gap-4 p-5 cursor-pointer hover:bg-kore-cream/20 transition-colors text-left">
        <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
          <div className={`absolute inset-0 rounded-full ${CB[color]}`} />
          <div ref={ringRef} className="absolute rounded-full" style={{ width: 12, height: 12, backgroundColor: RING_HEX[color] || RING_HEX.green, opacity: 0.4 }} />
          <div className="relative w-3 h-3 rounded-full z-10" style={{ backgroundColor: DOT_HEX[color] || DOT_HEX.green }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-kore-gray-dark">{info.title}</p>
          <p className="text-xs text-kore-gray-dark/50 mt-0.5">{category}</p>
        </div>
        <span className={`font-heading text-xl font-bold ${CT[color]}`}>{value}</span>
        <svg ref={arrowRef} className="w-5 h-5 text-kore-gray-dark/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div ref={contentRef} style={{ display: 'none', height: 0 }}>
        <div className="px-5 pb-5 space-y-3">
          <div className="idx-panel bg-kore-cream/40 rounded-xl p-4">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1.5">¿Qué se evalúa?</p>
            <p className="text-sm text-kore-gray-dark/80 leading-relaxed">{info.whatIs}</p>
            <p className="text-xs text-kore-gray-dark/50 mt-2"><strong>Tests:</strong> {info.tests}</p>
          </div>
          <div className={`idx-panel ${CB[color]} rounded-xl p-4`}>
            <p className={`text-xs ${CT[color]} uppercase tracking-wider font-medium mb-1.5`}>Tu resultado</p>
            <p className={`text-sm ${CT[color]}/80 leading-relaxed`}>{resultText}</p>
          </div>
          <div className="idx-panel bg-white rounded-xl p-4 border border-kore-gray-light/30">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wider font-medium mb-1.5">¿Qué importancia tiene en tu proceso?</p>
            <p className="text-sm text-kore-gray-dark/70 leading-relaxed">{importanceText}</p>
          </div>
          <div className="idx-panel bg-kore-red/5 rounded-xl p-4 border border-kore-red/10">
            <p className="text-xs text-kore-red/70 uppercase tracking-wider font-medium mb-1.5">¿Qué sigue con tu entrenador?</p>
            <p className="text-sm text-kore-gray-dark/70 leading-relaxed">{nextStepText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reference ranges per test ── */
const TEST_RANGES: Record<string, { scale: string; interpret: (raw: number | null) => string }> = {
  squats: {
    scale: '<15 bajo · 15–25 regular · 26–35 bueno · >35 muy bueno',
    interpret: (r) => r == null ? '' : r < 15 ? 'Tu resistencia de piernas está en rango bajo. Hay espacio para mejorar.' : r <= 25 ? 'Tu resistencia de piernas está en rango regular. Tienes una base aceptable.' : r <= 35 ? 'Tu resistencia de piernas es buena. Puedes seguir progresando.' : 'Tu resistencia de piernas es muy buena. Excelente base funcional.',
  },
  pushups: {
    scale: '0–5 bajo · 6–12 regular · 13–20 bueno · >20 muy bueno',
    interpret: (r) => r == null ? '' : r <= 5 ? 'Tu fuerza de tren superior necesita desarrollo.' : r <= 12 ? 'Tu fuerza de tren superior es regular. Hay margen de mejora.' : r <= 20 ? 'Tu fuerza de tren superior es buena.' : 'Tu fuerza de tren superior es muy buena.',
  },
  plank: {
    scale: '<20s bajo · 20–40s regular · 41–60s bueno · >60s muy bueno',
    interpret: (r) => r == null ? '' : r < 20 ? 'Tu resistencia de core es baja. Es una prioridad para tu estabilidad.' : r <= 40 ? 'Tu core tiene una resistencia regular. Puede mejorar con trabajo específico.' : r <= 60 ? 'Tu resistencia de core es buena. Buen control central.' : 'Tu core es muy resistente. Excelente estabilidad.',
  },
  walk: {
    scale: 'Baja · Media · Buena · Muy buena',
    interpret: (r) => r == null ? '' : 'Tu capacidad aeróbica se evalúa según la distancia recorrida en 6 minutos, ajustada por edad y sexo.',
  },
  unipodal: {
    scale: '<10s bajo · 10–20s regular · 21–40s bueno · >40s muy bueno',
    interpret: (r) => r == null ? '' : r < 10 ? 'Tu estabilidad es baja. El equilibrio necesita trabajo prioritario.' : r <= 20 ? 'Tu estabilidad es regular. Puedes mejorar con ejercicios específicos.' : r <= 40 ? 'Tu estabilidad es buena. Buen control neuromuscular.' : 'Tu estabilidad es muy buena. Excelente control corporal.',
  },
};

const MOBILITY_SCALE = '1 limitada · 2 reducida · 3 funcional · 4 buena · 5 excelente';

/* ── Individual test scores bar chart ── */
function TestScores({ ev }: { ev: PhysicalEvaluation }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
      <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">Tus resultados por prueba</p>
      <div className="space-y-4">
        {TEST_LABELS.map(t => {
          const score = (ev[t.scoreKey] as number | null) ?? 0;
          const raw = ev[t.rawKey] as number | null;
          const pct = (score / 5) * 100;
          const barColor = score <= 2 ? 'bg-red-400' : score <= 3 ? 'bg-amber-400' : 'bg-green-500';
          const range = TEST_RANGES[t.key];
          const interpretation = range?.interpret(raw);
          return (
            <div key={t.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-kore-gray-dark/80 font-medium">{t.label}</span>
                <span className="text-xs text-kore-gray-dark/50">{raw != null ? `${raw} ${t.unit}` : '—'} → {score}/5</span>
              </div>
              <div className="h-1.5 bg-kore-gray-light/30 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              {range && (
                <p className="text-xs text-kore-gray-dark/35 mt-1">{range.scale}</p>
              )}
              {interpretation && (
                <p className="text-xs text-kore-gray-dark/60 mt-0.5 leading-relaxed">{interpretation}</p>
              )}
            </div>
          );
        })}
        {/* Mobility zones */}
        <div className="pt-2 border-t border-kore-gray-light/20">
          <p className="text-xs text-kore-gray-dark/50 font-medium mb-2">Movilidad</p>
          {[
            { label: 'Cadera', key: 'hip_mobility' as keyof PhysicalEvaluation },
            { label: 'Hombros', key: 'shoulder_mobility' as keyof PhysicalEvaluation },
            { label: 'Tobillo', key: 'ankle_mobility' as keyof PhysicalEvaluation },
          ].map(z => {
            const val = (ev[z.key] as number | null) ?? 0;
            const pct = (val / 5) * 100;
            const barColor = val <= 2 ? 'bg-red-400' : val === 3 ? 'bg-amber-400' : 'bg-green-500';
            const mobLabel = val <= 1 ? 'Limitada' : val === 2 ? 'Reducida' : val === 3 ? 'Funcional' : val === 4 ? 'Buena' : 'Excelente';
            return (
              <div key={z.key} className="mb-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-kore-gray-dark/70">{z.label}</span>
                  <span className="text-xs text-kore-gray-dark/50">{val}/5 · {mobLabel}</span>
                </div>
                <div className="h-1.5 bg-kore-gray-light/30 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-kore-gray-dark/35 mt-1">{MOBILITY_SCALE}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function MyPhysicalEvaluationPage() {
  const { user } = useAuthStore();
  const { evaluations, loading, fetchMyEvaluations } = usePhysicalEvaluationStore();
  const sectionRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchMyEvaluations();
  }, [fetchMyEvaluations]);

  useEffect(() => {
    if (!heroRef.current || loading) return;
    const cards = heroRef.current.querySelectorAll('.hero-stat');
    if (!cards.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(cards, { y: 30, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12, delay: 0.15, ease: 'back.out(1.4)' });
    });
    return () => ctx.revert();
  }, [loading, evaluations]);

  useEffect(() => {
    if (!cardsRef.current || loading) return;
    const cards = cardsRef.current.querySelectorAll('.idx-card');
    if (!cards.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(cards, { y: 24, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: cardsRef.current, start: 'top 85%', toggleActions: 'play none none none' },
      });
    });
    return () => ctx.revert();
  }, [loading, evaluations]);

  useEffect(() => {
    if (!timelineRef.current || loading) return;
    const entries = timelineRef.current.querySelectorAll('.tl-entry');
    if (!entries.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(entries, { x: -20, opacity: 0 }, {
        x: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: 'power2.out',
        scrollTrigger: { trigger: timelineRef.current, start: 'top 85%', toggleActions: 'play none none none' },
      });
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

  const latest: PhysicalEvaluation | null = evaluations[0] || null;

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16">
        <div data-hero="badge" className="mb-8 xl:mb-10">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu salud</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">Mi Condición Física</h1>
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
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Tu evaluación física está en camino</h2>
            <p className="text-sm text-kore-gray-dark/50 mb-1">Tu entrenador realizará tu primera evaluación de condición física.</p>
            <p className="text-xs text-kore-gray-dark/40">Aquí podrás ver cómo evolucionan tu fuerza, resistencia, movilidad y equilibrio.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ══ Hero summary ══ */}
            <div ref={heroRef} className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'General', key: 'general' },
                { label: 'Fuerza', key: 'strength' },
                { label: 'Resistencia', key: 'endurance' },
                { label: 'Movilidad', key: 'mobility' },
                { label: 'Equilibrio', key: 'balance' },
              ].map(({ label, key }) => {
                const idx = String((latest as unknown as Record<string, unknown>)[`${key}_index`] ?? '0');
                const cat = String((latest as unknown as Record<string, unknown>)[`${key}_category`] ?? '');
                const col = String((latest as unknown as Record<string, unknown>)[`${key}_color`] ?? 'green');
                return (
                  <div key={key} className={`hero-stat backdrop-blur-sm rounded-2xl p-5 border shadow-sm text-center ${CB[col]} ${CBorder[col]}`}>
                    <p className={`text-xs ${CT[col]}/70 mb-2`}>{label}</p>
                    <p className={`font-heading text-2xl font-bold ${CT[col]}`}>
                      <CountUpNumber target={parseFloat(idx)} />
                    </p>
                    <p className={`text-xs ${CT[col]}/60 mt-1`}>{cat}</p>
                  </div>
                );
              })}
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

            {/* ══ Test scores ══ */}
            <TestScores ev={latest} />

            {/* ══ Index cards ══ */}
            <div>
              <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">Tus componentes en detalle</p>
              <p className="text-xs text-kore-gray-dark/50 mb-4">Toca cada componente para entender qué significa y qué puedes hacer.</p>
              <div ref={cardsRef} className="space-y-3">
                <IndexCard id="general" ev={latest} />
                <IndexCard id="strength" ev={latest} />
                <IndexCard id="endurance" ev={latest} />
                <IndexCard id="mobility" ev={latest} />
                <IndexCard id="balance" ev={latest} />
              </div>
            </div>

            {/* ══ Scientific basis ══ */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
              <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">¿Cómo se calcula?</p>
              {SCIENCE.map((sci, i) => (
                <div key={i} className="bg-kore-cream/20 rounded-xl p-4 border border-kore-gray-light/20 mb-2 last:mb-0">
                  <p className="text-xs text-kore-gray-dark/60 leading-relaxed mb-1">{sci.formula}</p>
                  <p className="text-xs text-kore-gray-dark/40 italic leading-relaxed">{sci.reference}</p>
                </div>
              ))}
            </div>

            {/* ══ Progress timeline ══ */}
            {evaluations.length > 1 && (
              <div ref={timelineRef} className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-base font-semibold text-kore-gray-dark mb-1">Tu evolución física</h2>
                <p className="text-xs text-kore-gray-dark/50 mb-4">Cada evaluación muestra cómo ha cambiado tu condición física.</p>
                <div className="relative">
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
                              <span>General: {ev.general_index}</span>
                              <span>Fza: {ev.strength_index}</span>
                              <span>Res: {ev.endurance_index}</span>
                              <span>Mov: {ev.mobility_index}</span>
                              <span>Eq: {ev.balance_index}</span>
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
