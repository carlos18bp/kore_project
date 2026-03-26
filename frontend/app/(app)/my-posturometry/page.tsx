'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuthStore } from '@/lib/stores/authStore';
import { usePosturometryStore, type PosturometryEvaluation } from '@/lib/stores/posturometryStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import ImageLightbox from '@/app/components/shared/ImageLightbox';

gsap.registerPlugin(ScrollTrigger);

/* ── Color helpers ── */
const CT: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', orange: 'text-orange-700', red: 'text-red-600' };
const CB: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', orange: 'bg-orange-100', red: 'bg-red-100' };
const CBorder: Record<string, string> = { green: 'border-green-200', yellow: 'border-amber-200', orange: 'border-orange-200', red: 'border-red-200' };
const RING_HEX: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', orange: '#f97316', red: '#ef4444' };
const DOT_HEX: Record<string, string> = { green: '#16a34a', yellow: '#d97706', orange: '#ea580c', red: '#dc2626' };

/* ── Educational content per region ── */
type RegionInfo = {
  title: string;
  whatIs: string;
  segments: string;
  result: Record<string, string>;
  importance: Record<string, string>;
  nextStep: Record<string, string>;
  action: Record<string, string>;
};

const REGION_INFO: Record<string, RegionInfo> = {
  global: {
    title: 'Tu postura general',
    whatIs: 'El índice postural global evalúa la alineación de todo tu cuerpo. Se calcula promediando los puntajes de 19 segmentos corporales observados desde 4 vistas distintas (anterior, lateral derecha, lateral izquierda y posterior). Es una fotografía completa de cómo está organizado tu cuerpo en el espacio.',
    segments: 'Todos los segmentos: cabeza, cuello, hombros, escápulas, columna, pelvis, rodillas, pies y más.',
    result: {
      green: 'Tu postura general es funcional. No se observan desbalances importantes en ninguna zona.',
      yellow: 'Tu postura muestra desbalances leves. Son comunes y corregibles con trabajo dirigido.',
      orange: 'Tu postura presenta desbalances moderados que conviene abordar de forma estructurada.',
      red: 'Tu postura muestra desbalances importantes que requieren atención prioritaria.',
    },
    importance: {
      green: 'Una buena postura general es la base de un movimiento eficiente y seguro. Esto te permite progresar con confianza.',
      yellow: 'Tu postura influye en cómo te mueves, cómo entrenas y cómo te sientes. Corregir estos desbalances mejora todo tu proceso.',
      orange: 'La postura afecta directamente tu rendimiento y tu riesgo de lesión. Mejorarla es una inversión en tu salud a largo plazo.',
      red: 'La postura es una prioridad porque afecta cómo distribuyes la carga en cada ejercicio. Corregirla protege tu cuerpo.',
    },
    nextStep: {
      green: 'Tu entrenador seguirá incluyendo consciencia postural en tu programa para mantener este buen estado.',
      yellow: 'Tu entrenador incluirá ejercicios correctivos específicos en tu próxima fase de entrenamiento.',
      orange: 'Tu entrenador priorizará el trabajo correctivo como parte central de tu programa.',
      red: 'Tu entrenador diseñará un plan enfocado primero en corrección postural antes de progresar en carga.',
    },
    action: {
      green: 'Sigue con tu programa de entrenamiento. La consciencia postural y el movimiento regular son tu mejor herramienta.',
      yellow: 'Tu entrenador ajustará tu programa para incluir ejercicios correctivos específicos.',
      orange: 'El trabajo correctivo será parte central de tu programa. Con constancia, estos patrones mejoran significativamente.',
      red: 'Tu programa se enfocará primero en corrección postural. La paciencia y la constancia son clave.',
    },
  },
  upper: {
    title: 'Zona superior',
    whatIs: 'La zona superior incluye cabeza, cuello, hombros, clavículas, escápulas y codos. Los desbalances aquí suelen relacionarse con hábitos del día a día: uso de computador, celular, posiciones sostenidas. Pueden generar tensión cervical, dolor de hombros y limitación de movilidad.',
    segments: 'Cabeza, cuello, hombros, clavículas, altura tetillas, escápulas, codos ángulo, codos flexionados, espacios brazo-tronco.',
    result: {
      green: 'Tu zona superior muestra una alineación funcional. No se observan desbalances importantes.',
      yellow: 'Se observan desbalances leves en la zona superior. Pueden estar relacionados con hábitos posturales.',
      orange: 'La zona superior muestra desbalances moderados que pueden estar afectando tu movilidad.',
      red: 'Se detectan desbalances importantes en la zona superior que requieren atención prioritaria.',
    },
    importance: {
      green: 'La zona superior influye en cómo usas los brazos, hombros y cuello en tu día a día y en el entrenamiento.',
      yellow: 'Los desbalances en esta zona suelen venir de hábitos posturales. Corregirlos mejora tu comodidad y movilidad.',
      orange: 'Una zona superior desalineada puede generar tensión, dolor y limitar tu rendimiento en ejercicios de empuje y tracción.',
      red: 'Esta zona requiere atención prioritaria porque afecta tu movilidad diaria y la calidad de tu entrenamiento.',
    },
    nextStep: {
      green: 'Tu entrenador mantendrá ejercicios de movilidad cervical y escapular en tu programa.',
      yellow: 'Tu entrenador incorporará trabajo de movilidad cervical y fortalecimiento escapular en tu plan.',
      orange: 'Tu entrenador incluirá trabajo correctivo: movilidad torácica, estabilización escapular y re-educación postural.',
      red: 'Tu entrenador priorizará la corrección de esta zona antes de progresar en carga de tren superior.',
    },
    action: {
      green: 'Mantén la consciencia postural. Los ejercicios de movilidad cervical y escapular ayudan a preservar este estado.',
      yellow: 'Incorpora ejercicios de movilidad cervical y fortalecimiento escapular. La corrección es alcanzable.',
      orange: 'Tu programa incluirá trabajo correctivo: movilidad torácica, estabilización escapular y re-educación postural.',
      red: 'El abordaje correctivo será una prioridad: movilidad, fortalecimiento y consciencia postural.',
    },
  },
  central: {
    title: 'Zona central',
    whatIs: 'La zona central incluye la columna vertebral, abdomen, cadera y pelvis. Es el centro de control de tu cuerpo — de aquí parte el equilibrio y la fuerza funcional. Desbalances en esta zona afectan todo lo demás.',
    segments: 'Columna vertebral, abdomen prominente, cadera, pliegue inguinal, pliegues laterales, altura cresta inguinales, glúteos.',
    result: {
      green: 'Tu zona central muestra buena alineación. El centro de tu cuerpo está equilibrado.',
      yellow: 'Se observan desbalances leves en la zona central. Pueden influir en cómo distribuyes la carga.',
      orange: 'La zona central muestra desbalances moderados que pueden afectar tu función.',
      red: 'Se detectan desbalances importantes en la zona central que requieren abordaje específico.',
    },
    importance: {
      green: 'El centro de tu cuerpo es donde nace la fuerza funcional. Un centro equilibrado mejora todo tu movimiento.',
      yellow: 'Los desbalances en la zona central afectan cómo distribuyes la carga y pueden generar compensaciones en otras zonas.',
      orange: 'La zona central es el eje de tu cuerpo. Mejorarla impacta directamente tu estabilidad, fuerza y prevención de lesiones.',
      red: 'Un centro desalineado afecta todo lo demás. Corregir esta zona es prioritario para tu seguridad y tu progreso.',
    },
    nextStep: {
      green: 'Tu entrenador seguirá fortaleciendo tu core y manteniendo la movilidad de tu columna.',
      yellow: 'Tu entrenador añadirá ejercicios de estabilización de core y movilidad de columna a tu programa.',
      orange: 'Tu entrenador incluirá trabajo correctivo: core profundo, movilidad segmentaria y control pélvico.',
      red: 'Tu entrenador priorizará la corrección de esta zona con trabajo progresivo de estabilidad y control motor.',
    },
    action: {
      green: 'Sigue fortaleciendo tu core y manteniendo la movilidad de columna.',
      yellow: 'Ejercicios de estabilización de core y movilidad de columna ayudarán a mejorar estos patrones.',
      orange: 'Se incluirá trabajo correctivo: core profundo, movilidad segmentaria y control pélvico.',
      red: 'Tu programa priorizará la corrección. Trabajo progresivo de estabilidad, movilidad y control motor.',
    },
  },
  lower: {
    title: 'Zona inferior',
    whatIs: 'El tren inferior incluye rodillas, pies y la zona poplítea. Es la base de apoyo de tu cuerpo — cómo pisas y alineas tus rodillas afecta toda la cadena hacia arriba. Un buen apoyo protege articulaciones y optimiza el movimiento.',
    segments: 'Rodillas, pies/pie, pliegues poplíteos.',
    result: {
      green: 'Tu tren inferior muestra buena alineación. La base de apoyo es funcional.',
      yellow: 'Se observan desbalances leves en el tren inferior. Pueden influir en cómo absorbes el impacto.',
      orange: 'El tren inferior muestra desbalances moderados que pueden afectar tu mecánica de movimiento.',
      red: 'Se detectan desbalances importantes en el tren inferior.',
    },
    importance: {
      green: 'Tus piernas y pies son la base de apoyo de tu cuerpo. Un buen apoyo protege articulaciones y optimiza el movimiento.',
      yellow: 'Los desbalances en el tren inferior afectan cómo absorbes el impacto al caminar, correr y entrenar.',
      orange: 'La alineación de rodillas y pies impacta toda la cadena de movimiento hacia arriba. Mejorarla previene problemas futuros.',
      red: 'El tren inferior es tu base. Corregir su alineación es fundamental para poder progresar con seguridad.',
    },
    nextStep: {
      green: 'Tu entrenador mantendrá el trabajo de fuerza de tren inferior y movilidad de tobillos en tu programa.',
      yellow: 'Tu entrenador incorporará ejercicios de estabilización de rodilla y movilidad de tobillo.',
      orange: 'Tu entrenador incluirá trabajo correctivo: glúteo medio, estabilización de rodilla y re-educación del apoyo.',
      red: 'Tu entrenador priorizará la corrección de alineación de rodillas y pies antes de progresar en carga.',
    },
    action: {
      green: 'Mantén el trabajo de fuerza de tren inferior y la movilidad de tobillos.',
      yellow: 'Ejercicios de fortalecimiento de estabilizadores de rodilla y movilidad de tobillo mejorarán estos patrones.',
      orange: 'Se incluirá trabajo correctivo: glúteo medio, estabilización de rodilla y re-educación del apoyo.',
      red: 'El programa priorizará corrección de alineación de rodillas y pies.',
    },
  },
};

/* ── Scientific basis ── */
const SCIENCE: Record<string, { formula: string; reference: string }> = {
  scoring: {
    formula: 'Cada segmento: 0=Normal, 1=Leve, 2=Moderado, 3=Severo. Índice = promedio de todos los puntajes consolidados.',
    reference: 'Adaptado de REEDCO Posture Score (1974) y New York Posture Rating Chart (1958).',
  },
  classification: {
    formula: '0.00–0.50 Funcional · 0.51–1.20 Leve · 1.21–2.00 Moderado · >2.00 Importante',
    reference: 'Kendall, F.P. et al. (2005). Muscles: Testing and Function with Posture and Pain. 5th ed.',
  },
  regions: {
    formula: 'Superior (cabeza→codos) · Central (columna→glúteos) · Inferior (rodillas→pies)',
    reference: 'Janda, V. (1996). Upper/lower crossed syndromes. Magee, D.J. (2014). Orthopedic Physical Assessment.',
  },
};

/* ── CountUp number ── */
function CountUpNumber({ target, decimals = 2 }: { target: number; decimals?: number }) {
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
        if (ref.current) ref.current.textContent = obj.val.toFixed(decimals);
      },
    });
  }, [target, decimals]);
  return <span ref={ref}>0</span>;
}

/* ── Region card with accordion ── */
function RegionCard({ id, ev }: { id: string; ev: PosturometryEvaluation }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const info = REGION_INFO[id];
  if (!info) return null;

  const getField = (key: string): string => String((ev as unknown as Record<string, unknown>)[key] ?? '');

  const value = getField(id === 'global' ? 'global_index' : `${id}_index`) || '0';
  const category = getField(id === 'global' ? 'global_category' : `${id}_category`);
  const color = getField(id === 'global' ? 'global_color' : `${id}_color`) || 'green';

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
            <p className="text-xs text-kore-gray-dark/50 mt-2"><strong>Segmentos:</strong> {info.segments}</p>
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

/* ── Top segments to work on ── */
function TopSegments({ ev }: { ev: PosturometryEvaluation }) {
  if (!ev.segment_scores) return null;
  const sorted = Object.entries(ev.segment_scores)
    .filter(([, s]) => s.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5);
  if (sorted.length === 0) return null;

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
      <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">Principales zonas por trabajar</p>
      <div className="space-y-2">
        {sorted.map(([key, seg]) => {
          const pct = (seg.score / 3) * 100;
          const barColor = seg.score <= 1 ? 'bg-amber-400' : seg.score <= 2 ? 'bg-orange-400' : 'bg-red-400';
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-kore-gray-dark/80 font-medium">{seg.label}</span>
                <span className="text-xs text-kore-gray-dark/50">{seg.score}/3</span>
              </div>
              <div className="h-1.5 bg-kore-gray-light/30 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function MyPosturometryPage() {
  const { user } = useAuthStore();
  const { evaluations, loading, fetchMyEvaluations } = usePosturometryStore();
  const sectionRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState('');
  const [lightboxAlt, setLightboxAlt] = useState('');
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchMyEvaluations();
  }, [fetchMyEvaluations]);

  // GSAP: Hero cards entrance
  useEffect(() => {
    if (!heroRef.current || loading) return;
    const cards = heroRef.current.querySelectorAll('.hero-stat');
    if (!cards.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(cards, { y: 30, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12, delay: 0.15, ease: 'back.out(1.4)' });
    });
    return () => ctx.revert();
  }, [loading, evaluations]);

  // GSAP: Index cards staggered entrance
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

  // GSAP: Timeline entries
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

  const latest: PosturometryEvaluation | null = evaluations[0] || null;

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16">
        <div data-hero="badge" className="mb-8 xl:mb-10">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Tu salud</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">Mi Postura</h1>
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Tu evaluación postural está en camino</h2>
            <p className="text-sm text-kore-gray-dark/50 mb-1">Tu entrenador realizará tu primera evaluación postural.</p>
            <p className="text-xs text-kore-gray-dark/40">Aquí podrás ver cómo evoluciona tu postura a lo largo del tiempo, con explicaciones claras de cada zona.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ══ Hero summary ══ */}
            <div ref={heroRef} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Global', key: 'global' },
                { label: 'Superior', key: 'upper' },
                { label: 'Central', key: 'central' },
                { label: 'Inferior', key: 'lower' },
              ].map(({ label, key }) => {
                const g = (k: string): string => String((latest as unknown as Record<string, unknown>)[k] ?? '');
                const idx = g(`${key}_index`) || '0';
                const cat = g(`${key}_category`);
                const col = g(`${key}_color`) || 'green';
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

            {/* ══ Top segments to work on ══ */}
            <TopSegments ev={latest} />

            {/* ══ Photos ══ */}
            {(latest.anterior_photo || latest.lateral_right_photo || latest.lateral_left_photo || latest.posterior_photo) && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">Tus fotos de evaluación</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { url: latest.anterior_photo, label: 'Anterior' },
                    { url: latest.lateral_right_photo, label: 'Lateral Derecha' },
                    { url: latest.lateral_left_photo, label: 'Lateral Izquierda' },
                    { url: latest.posterior_photo, label: 'Posterior' },
                  ].map((p) => p.url && (
                    <div key={p.label} className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (p.url) {
                            setLightboxSrc(p.url);
                            setLightboxAlt(p.label);
                            setLightboxOpen(true);
                          }
                        }}
                        className="relative group w-full rounded-xl overflow-hidden cursor-pointer"
                      >
                        <img src={p.url} alt={p.label} className="rounded-xl w-full h-48 object-cover border border-kore-gray-light/30" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                          </svg>
                        </div>
                      </button>
                      <p className="text-xs text-kore-gray-dark/50 mt-1">{p.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ Region cards with GSAP stagger ══ */}
            <div>
              <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">Tus zonas en detalle</p>
              <p className="text-xs text-kore-gray-dark/50 mb-4">Toca cada zona para entender qué significa y qué puedes hacer.</p>
              <div ref={cardsRef} className="space-y-3">
                <RegionCard id="global" ev={latest} />
                <RegionCard id="upper" ev={latest} />
                <RegionCard id="central" ev={latest} />
                <RegionCard id="lower" ev={latest} />
              </div>
            </div>

            {/* ══ Scientific basis ══ */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
              <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest font-medium mb-3">¿Cómo se calcula?</p>
              {Object.entries(SCIENCE).map(([key, sci]) => (
                <div key={key} className="bg-kore-cream/20 rounded-xl p-4 border border-kore-gray-light/20 mb-2 last:mb-0">
                  <p className="text-xs text-kore-gray-dark/60 leading-relaxed mb-1">{sci.formula}</p>
                  <p className="text-xs text-kore-gray-dark/40 italic leading-relaxed">{sci.reference}</p>
                </div>
              ))}
            </div>

            {/* ══ Progress timeline ══ */}
            {evaluations.length > 1 && (
              <div ref={timelineRef} className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-base font-semibold text-kore-gray-dark mb-1">Tu evolución postural</h2>
                <p className="text-xs text-kore-gray-dark/50 mb-4">Cada evaluación muestra cómo ha cambiado tu postura.</p>
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
                              <span>Global: {ev.global_index}</span>
                              <span>Sup: {ev.upper_index}</span>
                              <span>Cent: {ev.central_index}</span>
                              <span>Inf: {ev.lower_index}</span>
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

      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxSrc}
        alt={lightboxAlt}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </section>
  );
}
