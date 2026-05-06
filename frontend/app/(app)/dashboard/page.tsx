'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Flame, ArrowRight, Play,
  Calendar, ArrowUpRight, Check, X, Trophy,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useProgressStore } from '@/lib/stores/progressStore';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';
import SubscriptionExpiryReminder from '@/app/components/subscription/SubscriptionExpiryReminder';
import SubscriptionDashboardToast from '@/app/components/subscription/SubscriptionDashboardToast';
import ProgressTabsCard from '@/app/components/program/ProgressTabsCard';
import { useAnthropometryStore } from '@/lib/stores/anthropometryStore';
import { usePosturometryStore } from '@/lib/stores/posturometryStore';
import { usePhysicalEvaluationStore } from '@/lib/stores/physicalEvaluationStore';
import { useNutritionStore } from '@/lib/stores/nutritionStore';
import { useParqStore } from '@/lib/stores/parqStore';
import { ExpandableIndicator, type IndicatorData } from '@/app/components/dashboard/ExpandableIndicator';
import TrainerMessageBanner from '@/app/components/dashboard/TrainerMessageBanner';

// ── Helpers ───────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── AnimatedHero ──────────────────────────────────────────────

function AnimatedHero({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] shadow-2xl"
      style={{ background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #0b1220 100%)' }}
    >
      <style>{`
        @keyframes kore-orb-1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.15)}}
        @keyframes kore-orb-2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,40px) scale(0.9)}}
        @keyframes kore-orb-3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,30px) scale(1.1)}}
        @keyframes kore-aurora{0%,100%{opacity:0.45}50%{opacity:0.85}}
      `}</style>
      {/* Aurora */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 80% 20%, #9A052640 0%, transparent 50%), radial-gradient(ellipse at 10% 90%, #6A041A50 0%, transparent 55%)',
          animation: 'kore-aurora 8s ease-in-out infinite',
        }}
      />
      {/* Orb 1 */}
      <div
        className="absolute pointer-events-none"
        style={{ top: '20%', right: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, #E0000066 0%, #AB0D2F22 50%, transparent 70%)', filter: 'blur(30px)', animation: 'kore-orb-1 9s ease-in-out infinite' }}
      />
      {/* Orb 2 */}
      <div
        className="absolute pointer-events-none"
        style={{ bottom: '10%', left: '20%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, #9A052655 0%, transparent 70%)', filter: 'blur(40px)', animation: 'kore-orb-2 11s ease-in-out infinite' }}
      />
      {/* Orb 3 */}
      <div
        className="absolute pointer-events-none"
        style={{ top: '50%', left: '50%', width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, #CD0C3644 0%, transparent 70%)', filter: 'blur(35px)', animation: 'kore-orb-3 7s ease-in-out infinite' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ── Arc ring SVG ──────────────────────────────────────────────

function ArcRing({ pct, size = 56, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id="kore-arc-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#670F22" />
          <stop offset="100%" stopColor="#AB0D2F" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E5E5" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#kore-arc-grad)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
      />
    </svg>
  );
}

// ── Projection progress bar ───────────────────────────────────

// ── Real evaluation cards (from stores) ──────────────────────

type RealEvalGridProps = {
  posturoEvals: import('@/lib/stores/posturometryStore').PosturometryEvaluation[];
  anthroEvals: import('@/lib/stores/anthropometryStore').AnthropometryEvaluation[];
  physicalEvals: import('@/lib/stores/physicalEvaluationStore').PhysicalEvaluation[];
  parqAssessments: import('@/lib/stores/parqStore').ParqAssessment[];
  todayMood: import('@/lib/stores/profileStore').TodayMood | null;
  motivationMessage?: string;
  gridClass?: string;
};

function RealEvalGrid({ posturoEvals, anthroEvals, physicalEvals, parqAssessments, todayMood, motivationMessage, gridClass = 'grid-cols-2' }: RealEvalGridProps) {
  const hasAny = posturoEvals.length > 0 || anthroEvals.length > 0 || physicalEvals.length > 0;
  if (!hasAny) return null;
  const CTP: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', orange: 'text-orange-700', red: 'text-red-600' };
  const CBP: Record<string, string> = { green: 'bg-green-100', yellow: 'bg-amber-100', orange: 'bg-orange-100', red: 'bg-red-100' };
  const FILL_P: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500' };
  const CT: Record<string, string> = { green: 'text-green-700', yellow: 'text-amber-700', red: 'text-red-600' };
  return (
    <div className={`grid ${gridClass} gap-2 md:gap-3 xl:gap-4`}>

      {/* Posturometry */}
      {posturoEvals.length > 0 && (() => {
        const latest = posturoEvals[0];
        const first = posturoEvals.length > 1 ? posturoEvals[posturoEvals.length - 1] : null;
        const zones = [
          { key: 'global', label: 'General', idx: latest.global_index, col: latest.global_color, firstIdx: first?.global_index },
          { key: 'upper', label: 'Superior', idx: latest.upper_index, col: latest.upper_color, firstIdx: first?.upper_index },
          { key: 'central', label: 'Central', idx: latest.central_index, col: latest.central_color, firstIdx: first?.central_index },
          { key: 'lower', label: 'Inferior', idx: latest.lower_index, col: latest.lower_color, firstIdx: first?.lower_index },
        ];
        const globalDiff = first ? parseFloat(latest.global_index) - parseFloat(first.global_index) : null;
        const posturoIndicators: IndicatorData[] = [
          { key: 'upper', label: 'Zona superior', value: latest.upper_index, category: latest.upper_category || 'Funcional', color: latest.upper_color,
            whatIs: 'Incluye cabeza, cuello, hombros, escápulas y codos.',
            meaning: latest.upper_color === 'green' ? 'Tu zona superior muestra alineación funcional.' : latest.upper_color === 'yellow' ? 'Se observan desbalances leves posiblemente por hábitos posturales.' : 'Se detectan desbalances que pueden afectar tu movilidad.',
            importance: 'La zona superior influye en cómo usas los brazos, hombros y cuello.',
            nextStep: 'Tu entrenador incorporará ejercicios de movilidad y fortalecimiento adaptados a esta zona.' },
          { key: 'central', label: 'Zona central', value: latest.central_index, category: latest.central_category || 'Funcional', color: latest.central_color,
            whatIs: 'Incluye columna vertebral, abdomen, cadera y pelvis.',
            meaning: latest.central_color === 'green' ? 'Tu zona central muestra buena alineación.' : latest.central_color === 'yellow' ? 'Se observan desbalances leves.' : 'Hay desbalances que pueden afectar tu estabilidad.',
            importance: 'El centro de tu cuerpo es donde nace la fuerza funcional.',
            nextStep: 'Tu entrenador incluirá trabajo de core y movilidad de columna.' },
          { key: 'lower', label: 'Zona inferior', value: latest.lower_index, category: latest.lower_category || 'Funcional', color: latest.lower_color,
            whatIs: 'Incluye rodillas, pies y zona poplítea.',
            meaning: latest.lower_color === 'green' ? 'Tu tren inferior muestra buena alineación.' : latest.lower_color === 'yellow' ? 'Se observan desbalances leves.' : 'Hay desbalances que pueden afectar tu mecánica.',
            importance: 'Tus piernas y pies son la base de apoyo de tu cuerpo.',
            nextStep: 'Tu entrenador incorporará ejercicios de estabilización.' },
        ];
        return (
          <Link href="/my-posturometry" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
            <div className="flex items-center justify-between mb-1.5 md:mb-2.5">
              <h2 className={`font-heading text-xs md:text-base font-semibold ${CTP[latest.global_color] || CTP.green}`}>{latest.global_category || 'Postura'}</h2>
              <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </div>
            <div className="flex items-center gap-2 md:gap-2.5">
              <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center ${CBP[latest.global_color] || CBP.green}`}>
                <span className={`font-heading text-lg md:text-xl font-bold ${CTP[latest.global_color] || CTP.green}`}>{latest.global_index}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] md:text-xs text-kore-gray-dark/50 leading-snug">Escala 0–3 · más cerca de 0 es mejor</p>
                {globalDiff !== null && Math.abs(globalDiff) >= 0.05 && (
                  <p className={`text-[9px] md:text-[10px] font-semibold mt-0.5 ${globalDiff < 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {globalDiff < 0 ? 'Mejoró' : 'Subió'} {Math.abs(globalDiff).toFixed(2)} desde inicio
                  </p>
                )}
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              {zones.map((z) => {
                const val = parseFloat(z.idx);
                const pct = Math.min((val / 3) * 100, 100);
                const col = z.col || 'green';
                return (
                  <div key={z.key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] md:text-xs text-kore-gray-dark/60 font-medium">{z.label}</span>
                      <span className={`text-[10px] md:text-xs font-bold ${CTP[col] || CTP.green}`}>{z.idx}</span>
                    </div>
                    <div className={`h-1.5 md:h-2 rounded-full ${CBP[col] || CBP.green} overflow-hidden`}>
                      <div className={`h-full rounded-full ${FILL_P[col] || FILL_P.green} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block">
              <p className="text-xs text-kore-gray-dark/35 mb-1.5 mt-2.5">Toca cada zona para ver qué significa</p>
              <div className="pt-2.5 border-t border-kore-gray-light/20 space-y-0.5">
                {posturoIndicators.map((ind) => <ExpandableIndicator key={ind.key} ind={ind} />)}
              </div>
              {latest.notes && (
                <div className="pt-2 border-t border-kore-gray-light/20 mt-2">
                  <p className="text-xs text-kore-gray-dark/40 uppercase tracking-wider font-medium mb-0.5">Tu entrenador</p>
                  <p className="text-xs text-kore-gray-dark/60 leading-relaxed line-clamp-2 italic">{latest.notes}</p>
                </div>
              )}
            </div>
          </Link>
        );
      })()}

      {/* Anthropometry */}
      {anthroEvals.length > 0 && (() => {
        const latest = anthroEvals[0];
        const first = anthroEvals.length > 1 ? anthroEvals[anthroEvals.length - 1] : null;
        const weightDiff = first ? parseFloat(latest.weight_kg) - parseFloat(first.weight_kg) : null;
        const fatDiff = first ? parseFloat(latest.body_fat_pct) - parseFloat(first.body_fat_pct) : null;
        const anthroIndicators: IndicatorData[] = [
          { key: 'bf', label: 'Composición corporal', value: latest.body_fat_pct, unit: '%', category: latest.bf_category, color: latest.bf_color,
            whatIs: 'El porcentaje de grasa indica qué parte de tu peso total es grasa corporal.',
            meaning: latest.bf_color === 'green' ? 'Tu porcentaje de grasa está en un rango saludable.' : latest.bf_color === 'yellow' ? 'Tu grasa corporal está un poco por encima del rango ideal.' : 'Tu porcentaje de grasa está elevado.',
            importance: 'Ayuda a ver si estás mejorando la proporción entre grasa y músculo.',
            nextStep: 'Tu entrenador ajustará la intensidad para optimizar tu composición corporal.',
            formula: '%Grasa = (1.20 × IMC) + (0.23 × edad) − (10.8 × sexo) − 5.4' },
          { key: 'bmi', label: 'IMC – Peso y estatura', value: latest.bmi, category: latest.bmi_category, color: latest.bmi_color,
            whatIs: 'El IMC compara tu peso con tu estatura.',
            meaning: latest.bmi_color === 'green' ? 'Tu peso está dentro del rango saludable.' : latest.bmi_color === 'yellow' ? 'Tu peso está ligeramente por encima del rango ideal.' : 'Tu peso está en un rango que requiere atención.',
            importance: 'Ayuda a entender tu estado general de peso.',
            nextStep: 'Tu entrenador tendrá este resultado en cuenta para ajustar tu proceso.',
            formula: 'IMC = peso (kg) / estatura (m)²' },
          ...(latest.waist_cm ? [{ key: 'waist', label: 'Zona abdominal – Cintura', value: latest.waist_cm, unit: ' cm', category: latest.waist_risk || '—', color: latest.waist_risk_color,
            whatIs: 'El perímetro de cintura es un indicador directo de riesgo metabólico.',
            meaning: latest.waist_risk_color === 'green' ? 'Tu cintura está en un rango seguro.' : latest.waist_risk_color === 'yellow' ? 'Tu cintura está en una zona de atención.' : 'Tu cintura indica acumulación de grasa abdominal.',
            importance: 'La cintura tiene relación directa con la grasa que rodea tus órganos internos.',
            nextStep: 'Tu entrenador incluirá estrategias para reducir la cintura de forma progresiva.',
            formula: 'Perímetro de cintura (cm) comparado con umbrales OMS' } as IndicatorData] : []),
        ];
        return (
          <Link href="/my-diagnosis" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
            <div className="flex items-center justify-between mb-1.5 md:mb-2.5">
              <h2 className="font-heading text-xs md:text-base font-semibold text-kore-gray-dark">Diagnóstico</h2>
              <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </div>
            {/* Mobile simplified */}
            <div className="md:hidden space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-11 h-11 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-heading text-base font-bold text-kore-gray-dark">{latest.weight_kg}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-kore-gray-dark/40">Peso actual</p>
                  <p className={`text-sm font-semibold ${CT[latest.bf_color] || CT.green}`}>{latest.body_fat_pct}% grasa</p>
                </div>
              </div>
              {(() => {
                const fat = parseFloat(latest.fat_mass_kg);
                const lean = parseFloat(latest.lean_mass_kg);
                const total = fat + lean;
                if (total === 0) return null;
                return (
                  <div className="pt-1.5">
                    <div className="flex h-2.5 rounded-full overflow-hidden">
                      <div className="bg-red-400" style={{ width: `${(fat / total) * 100}%` }} />
                      <div className="bg-green-500" style={{ width: `${(lean / total) * 100}%` }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[8px] text-kore-gray-dark/60 font-medium">{fat.toFixed(1)} kg grasa</span>
                      <span className="text-[8px] text-kore-gray-dark/60 font-medium">{lean.toFixed(1)} kg músculo</span>
                    </div>
                  </div>
                );
              })()}
              {first && (weightDiff !== null || fatDiff !== null) && (
                <div className="flex items-center gap-1.5 pt-0.5 text-[9px]">
                  <span className="text-kore-gray-dark/50">Desde inicio:</span>
                  {weightDiff !== null && Math.abs(weightDiff) >= 0.1 && (
                    <span className={`font-semibold ${weightDiff < 0 ? 'text-green-600' : 'text-red-500'}`}>{weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(1)} kg</span>
                  )}
                  {fatDiff !== null && Math.abs(fatDiff) >= 0.1 && (
                    <span className={`font-semibold ${fatDiff < 0 ? 'text-green-600' : 'text-red-500'}`}>{fatDiff > 0 ? '+' : ''}{fatDiff.toFixed(1)}%</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1.5">
                <div className="flex-1 bg-green-50 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[9px] text-green-700/60">Músculo</p>
                  <p className="text-xs font-bold text-green-700">{latest.lean_mass_kg} <span className="font-normal">kg</span></p>
                </div>
                <div className={`flex-1 rounded-lg px-2 py-1.5 text-center ${latest.bmi_color === 'green' ? 'bg-green-50' : latest.bmi_color === 'yellow' ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <p className={`text-[9px] ${latest.bmi_color === 'green' ? 'text-green-700/60' : latest.bmi_color === 'yellow' ? 'text-amber-700/60' : 'text-red-600/60'}`}>IMC</p>
                  <p className={`text-xs font-bold ${latest.bmi_color === 'green' ? 'text-green-700' : latest.bmi_color === 'yellow' ? 'text-amber-700' : 'text-red-600'}`}>{latest.bmi}</p>
                </div>
              </div>
            </div>
            {/* Desktop full */}
            <div className="hidden md:grid grid-cols-3 gap-1.5 mb-2.5">
              {[
                { label: 'kg', val: latest.weight_kg, colClass: 'text-kore-gray-dark' },
                { label: 'grasa', val: `${latest.body_fat_pct}%`, colClass: CT[latest.bf_color] || CT.green },
                { label: 'masa libre', val: latest.lean_mass_kg, colClass: 'text-green-700' },
              ].map((item) => (
                <div key={item.label} className="text-center bg-kore-cream/40 rounded-lg py-1.5">
                  <p className={`font-heading text-base font-bold ${item.colClass}`}>{item.val}</p>
                  <p className="text-xs text-kore-gray-dark/40">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              {(() => {
                const fat = parseFloat(latest.fat_mass_kg);
                const lean = parseFloat(latest.lean_mass_kg);
                const total = fat + lean;
                if (total === 0) return null;
                const fatPct = (fat / total) * 100;
                const leanPct = (lean / total) * 100;
                return (
                  <div className="mb-2">
                    <div className="flex h-3 rounded-full overflow-hidden">
                      <div className="bg-red-400 flex items-center justify-center" style={{ width: `${fatPct}%` }}>
                        {fatPct > 15 && <span className="text-[8px] text-white font-bold">{fatPct.toFixed(0)}%</span>}
                      </div>
                      <div className="bg-green-500 flex items-center justify-center" style={{ width: `${leanPct}%` }}>
                        {leanPct > 15 && <span className="text-[8px] text-white font-bold">{leanPct.toFixed(0)}%</span>}
                      </div>
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] text-kore-gray-dark/60 font-medium">Grasa {fat.toFixed(1)} kg</span>
                      <span className="text-[9px] text-kore-gray-dark/60 font-medium">Músculo {lean.toFixed(1)} kg</span>
                    </div>
                  </div>
                );
              })()}
              {first && (weightDiff !== null || fatDiff !== null) && (
                <div className="flex items-center gap-2 text-xs mb-1.5">
                  <span className="text-kore-gray-dark/40">Desde inicio:</span>
                  {weightDiff !== null && Math.abs(weightDiff) >= 0.1 && (
                    <span className={weightDiff < 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(1)} kg</span>
                  )}
                  {fatDiff !== null && Math.abs(fatDiff) >= 0.1 && (
                    <span className={fatDiff < 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{fatDiff > 0 ? '+' : ''}{fatDiff.toFixed(1)}% grasa</span>
                  )}
                </div>
              )}
              <p className="text-xs text-kore-gray-dark/35 mb-1.5">Toca cada indicador para ver qué significa</p>
              <div className="pt-2.5 border-t border-kore-gray-light/20 space-y-0.5">
                {anthroIndicators.map((ind) => <ExpandableIndicator key={ind.key} ind={ind} />)}
              </div>
              {latest.notes && (
                <div className="pt-2 border-t border-kore-gray-light/20 mt-2">
                  <p className="text-xs text-kore-gray-dark/40 uppercase tracking-wider font-medium mb-0.5">Tu entrenador</p>
                  <p className="text-xs text-kore-gray-dark/60 leading-relaxed line-clamp-2 italic">{latest.notes}</p>
                </div>
              )}
            </div>
          </Link>
        );
      })()}

      {/* Physical evaluation */}
      {physicalEvals.length > 0 && (() => {
        const latest = physicalEvals[0];
        const physIndicators: IndicatorData[] = [
          { key: 'strength', label: 'Fuerza', value: latest.strength_index ?? '—', category: latest.strength_category || '—', color: latest.strength_color,
            whatIs: 'Evalúa la capacidad de tus músculos para sostener esfuerzos repetidos.',
            meaning: latest.strength_color === 'green' ? 'Tu fuerza-resistencia es funcional.' : latest.strength_color === 'yellow' ? 'Tu fuerza está por debajo del promedio.' : 'Tu fuerza necesita desarrollo prioritario.',
            importance: 'La fuerza es fundamental para proteger articulaciones y mejorar postura.',
            nextStep: 'Tu entrenador adaptará los ejercicios de fuerza a tu nivel actual.' },
          { key: 'endurance', label: 'Resistencia', value: latest.endurance_index ?? '—', category: latest.endurance_category || '—', color: latest.endurance_color,
            whatIs: 'Mide tu capacidad aeróbica funcional.',
            meaning: latest.endurance_color === 'green' ? 'Tu capacidad aeróbica es buena.' : latest.endurance_color === 'yellow' ? 'Tu capacidad aeróbica está por debajo del rango esperado.' : 'Tu resistencia necesita mejora significativa.',
            importance: 'Tu resistencia afecta cuánto puedes rendir en cada sesión.',
            nextStep: 'Tu entrenador incorporará actividad cardiovascular adaptada a tu capacidad.' },
          { key: 'mobility', label: 'Movilidad', value: latest.mobility_index ?? '—', category: latest.mobility_category || '—', color: latest.mobility_color,
            whatIs: 'Evalúa los rangos de movimiento de cadera, hombros y tobillo.',
            meaning: latest.mobility_color === 'green' ? 'Tu movilidad articular es funcional.' : latest.mobility_color === 'yellow' ? 'Algunas zonas articulares tienen limitaciones leves.' : 'Hay limitaciones de movilidad que pueden afectar tu movimiento.',
            importance: 'Sin movilidad adecuada no es seguro progresar en carga.',
            nextStep: 'Tu entrenador incluirá ejercicios específicos de movilidad.' },
          { key: 'balance', label: 'Equilibrio', value: latest.balance_index ?? '—', category: latest.balance_category || '—', color: latest.balance_color,
            whatIs: 'Mide tu control neuromuscular y estabilidad.',
            meaning: latest.balance_color === 'green' ? 'Tu equilibrio y control son adecuados.' : latest.balance_color === 'yellow' ? 'Tu equilibrio está por debajo del promedio.' : 'Tu equilibrio necesita atención prioritaria.',
            importance: 'El equilibrio protege contra caídas y refleja la calidad de tu control corporal.',
            nextStep: 'Tu entrenador incorporará trabajo de estabilidad adaptado a tu nivel.' },
        ];
        return (
          <Link href="/my-physical-evaluation" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
            <div className="flex items-center justify-between mb-1.5 md:mb-2.5">
              <h2 className="font-heading text-xs md:text-base font-semibold text-kore-gray-dark">Condición física</h2>
              <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </div>
            <div className="flex items-center gap-2 md:gap-2.5">
              <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center ${CBP[latest.general_color] || CBP.green}`}>
                <span className={`font-heading text-lg md:text-xl font-bold ${CTP[latest.general_color] || CTP.green}`}>{latest.general_index}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm md:text-base font-semibold ${CTP[latest.general_color] || CTP.green} line-clamp-1`}>{latest.general_category}</p>
                <p className="text-[10px] md:text-xs text-kore-gray-dark/40">Índice general</p>
              </div>
            </div>
            {/* Mobile mini indicators */}
            <div className="grid grid-cols-2 gap-x-1 gap-y-1 mt-2 md:hidden">
              {physIndicators.map((ind) => (
                <div key={ind.key} className="flex items-center gap-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${ind.color === 'green' ? 'bg-green-500' : ind.color === 'yellow' ? 'bg-amber-400' : 'bg-red-500'}`} />
                  <span className="text-[9px] text-kore-gray-dark/40 truncate">{ind.label}</span>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <p className="text-xs text-kore-gray-dark/35 mb-1.5 mt-2.5">Toca cada componente para ver qué significa</p>
              <div className="pt-2.5 border-t border-kore-gray-light/20 space-y-0.5">
                {physIndicators.map((ind) => <ExpandableIndicator key={ind.key} ind={ind} />)}
              </div>
              {latest.notes && (
                <div className="pt-2 border-t border-kore-gray-light/20 mt-2">
                  <p className="text-xs text-kore-gray-dark/40 uppercase tracking-wider font-medium mb-0.5">Tu entrenador</p>
                  <p className="text-xs text-kore-gray-dark/60 leading-relaxed line-clamp-2 italic">{latest.notes}</p>
                </div>
              )}
            </div>
          </Link>
        );
      })()}

      {/* Mood + PARQ stacked in 4th slot */}
      {(todayMood !== undefined || parqAssessments.length > 0) && (
        <div className="col-span-1 grid grid-cols-1 gap-2 md:gap-3">
          {/* ¿Cómo te sientes hoy? — clicking the card opens the global MoodCheckIn modal */}
          <button
            type="button"
            onClick={() => useProfileStore.getState().openMoodModal()}
            className="text-left bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all active:scale-[0.99]"
          >
            <p className="text-[10px] md:text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-2 md:mb-3">
              ¿Cómo te sientes hoy?
            </p>
            {todayMood ? (
              <div>
                <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2">
                  <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-heading text-sm md:text-base font-bold flex-shrink-0 ${
                    todayMood.score >= 7 ? 'bg-emerald-100 text-emerald-700' : todayMood.score >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {todayMood.score}
                  </div>
                  <div>
                    <p className={`text-xs md:text-[14px] font-semibold ${
                      todayMood.score >= 7 ? 'text-emerald-700' : todayMood.score >= 4 ? 'text-amber-700' : 'text-red-600'
                    }`}>
                      {todayMood.score >= 9 ? 'Imparable' : todayMood.score >= 7 ? 'Bien' : todayMood.score >= 5 ? 'Regular' : todayMood.score >= 3 ? 'Bajo' : 'Muy bajo'}
                    </p>
                    <p className="text-[10px] md:text-[11px] text-kore-gray-dark/40">{todayMood.score} de 10</p>
                  </div>
                </div>
                <p className="text-[10px] md:text-[12px] text-kore-gray-dark/55 leading-relaxed">
                  Toca para actualizar tu estado o agregar una nota.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] md:text-[13px] text-kore-gray-dark/50 mb-2 md:mb-3">
                  Aún no registraste tu estado de hoy.
                </p>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-kore-red text-white rounded-xl text-[11px] md:text-[12px] font-semibold"
                >
                  Registrar estado
                </span>
              </div>
            )}
          </button>
          {/* Motivación */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm">
            <p className="text-[10px] md:text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-2 md:mb-3">
              Tu motivación de hoy
            </p>
            <p className="text-[11px] md:text-[13px] text-kore-gray-dark font-medium leading-[1.5]">
              &ldquo;{motivationMessage ?? 'Cada día que entrenas, construyes la mejor versión de ti.'}&rdquo;
            </p>
            <p className="text-[10px] md:text-[11px] text-kore-gray-dark/50 mt-2 italic">
              — Personalizado según tu progreso
            </p>
          </div>
          {parqAssessments.length > 0 && (() => {
            const latest = parqAssessments[0];
            const CTQ: Record<string, string> = { green: 'text-emerald-700', yellow: 'text-amber-700', red: 'text-red-600' };
            const CBQ: Record<string, string> = { green: 'bg-emerald-100', yellow: 'bg-amber-100', red: 'bg-red-100' };
            return (
              <Link href="/my-parq" className="block bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl p-2.5 md:p-4 border border-white/60 shadow-sm hover:shadow-md hover:border-kore-red/20 transition-all group">
                <div className="flex items-center justify-between mb-1.5 md:mb-2">
                  <h2 className="font-heading text-xs md:text-base font-semibold text-kore-gray-dark">PAR-Q+</h2>
                  <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-kore-gray-dark/30 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2.5">
                  <div className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center ${CBQ[latest.risk_color] || CBQ.green}`}>
                    {latest.risk_color === 'green' ? (
                      <svg className={`w-4 h-4 md:w-5 md:h-5 ${CTQ.green}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    ) : latest.risk_color === 'yellow' ? (
                      <svg className={`w-4 h-4 md:w-5 md:h-5 ${CTQ.yellow}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                    ) : (
                      <svg className={`w-4 h-4 md:w-5 md:h-5 ${CTQ.red}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-[10px] md:text-xs font-medium ${CTQ[latest.risk_color] || CTQ.green}`}>{latest.risk_label}</p>
                    <p className="text-[9px] md:text-xs text-kore-gray-dark/40">{latest.yes_count}/7 respuestas afirmativas</p>
                  </div>
                </div>
              </Link>
            );
          })()}
        </div>
      )}

    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const {
    activeSubscription: sub,
    fetchSubscriptions,
    subscriptions,
    hasOwnActiveSubscription,
    subscriptionsLoaded,
  } = useSubscriptionStore();
  const { upcomingReminder, bookings, fetchUpcomingReminder, fetchBookings } = useBookingStore();
  const { profile, todayMood, fetchProfile } = useProfileStore();
  const { koreIndex, fetchPending: fetchPendingAssessments } = usePendingAssessmentsStore();
  const { todayLog: nutritionTodayLog, fetchTodayLog: fetchNutritionToday } = useNutritionDailyStore();
  const { activeProgram, fetchActiveProgram } = useProgramStore();
  const { weeklySummary, fetchWeeklySummary } = useProgressStore();
  const { evaluations: anthroEvals, fetchMyEvaluations: fetchMyAnthrometry } = useAnthropometryStore();
  const { evaluations: posturoEvals, fetchMyEvaluations: fetchMyPosturo } = usePosturometryStore();
  const { evaluations: physicalEvals, fetchMyEvaluations: fetchMyPhysical } = usePhysicalEvaluationStore();
  const { entries: nutritionEntries, fetchMyEntries: fetchMyNutrition } = useNutritionStore();
  const { assessments: parqAssessments, fetchMyAssessments: fetchMyParq } = useParqStore();
  const profileFetchedRef = useRef(false);

  useEffect(() => {
    fetchSubscriptions();
    fetchUpcomingReminder();
    fetchBookings();
    fetchPendingAssessments();
    fetchActiveProgram();
    fetchWeeklySummary();
    fetchNutritionToday();
    if (!anthroEvals.length) fetchMyAnthrometry();
    if (!posturoEvals.length) fetchMyPosturo();
    if (!physicalEvals.length) fetchMyPhysical();
    if (!nutritionEntries.length) fetchMyNutrition();
    if (!parqAssessments.length) fetchMyParq();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSubscriptions, fetchUpcomingReminder, fetchBookings, fetchPendingAssessments, fetchActiveProgram, fetchWeeklySummary, fetchNutritionToday, fetchMyAnthrometry, fetchMyPosturo, fetchMyPhysical, fetchMyNutrition, fetchMyParq]);

  useEffect(() => {
    if (profileFetchedRef.current) return;
    profileFetchedRef.current = true;
    fetchProfile();
  }, [fetchProfile]);

  // ── Streak ─────────────────────────────────────────────────
  // Source: weekly adherence summary (matches /mi-programa).
  const streakCount = weeklySummary?.streak.current ?? 0;
  const longestStreak = weeklySummary?.streak.longest ?? 0;

  // ── Session ────────────────────────────────────────────────
  const formattedDate = upcomingReminder?.slot
    ? new Date(upcomingReminder.slot.starts_at).toLocaleDateString('es-CO', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : null;
  const formattedTime = upcomingReminder?.slot
    ? new Date(upcomingReminder.slot.starts_at).toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '';
  const sessionInDays = upcomingReminder?.slot
    ? Math.max(0, Math.ceil(
        (new Date(upcomingReminder.slot.starts_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ))
    : null;
  const trainerName = upcomingReminder?.trainer
    ? `${upcomingReminder.trainer.first_name} ${upcomingReminder.trainer.last_name}`.trim()
    : null;

  // ── Nutrition ──────────────────────────────────────────────
  const mealLabels: Record<string, string> = {
    breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena',
    snack: 'Merienda', snack2: 'Merienda 2',
  };
  const mealEntries = nutritionTodayLog?.meal_entries ?? [];
  const nutritionTotal = mealEntries.length;
  const nutritionCompleted = mealEntries.filter((e) => e.status === 'completed').length;
  const nutritionPct = nutritionTotal > 0 ? Math.round((nutritionCompleted / nutritionTotal) * 100) : 0;

  // ── Program day ────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const todayProgDay = activeProgram?.days.find((d) => d.date === today);
  const hasRoutine = !!(todayProgDay && todayProgDay.day_type !== 'rest' && todayProgDay.exercises.length > 0);
  const allExercises = todayProgDay?.exercises ?? [];
  const exerciseCount = allExercises.length;
  const estimatedMin = exerciseCount * 8;
  const previewExercises = allExercises.slice(0, 4);
  const dayLabel = todayProgDay?.day_type === 'active_rest' ? 'Descanso activo' : 'Entrenamiento';

  // ── KÓRE score color ───────────────────────────────────────
  const scoreColorClass =
    koreIndex?.kore_color === 'green' ? 'text-emerald-600'
    : koreIndex?.kore_color === 'yellow' ? 'text-amber-500'
    : koreIndex?.kore_color === 'orange' ? 'text-orange-500'
    : 'text-kore-red';

  // ── Historial (past confirmed bookings) ────────────────────
  const pastBookings = bookings
    .filter((b) => new Date(b.slot.starts_at).getTime() < Date.now())
    .sort((a, b) => new Date(b.slot.starts_at).getTime() - new Date(a.slot.starts_at).getTime())
    .slice(0, 5);

  // ── Special states ─────────────────────────────────────────
  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div
          className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full"
          role="status"
          aria-label="Cargando"
        />
      </section>
    );
  }

  const isGuestDashboard =
    subscriptionsLoaded &&
    !hasOwnActiveSubscription &&
    subscriptions.some((s) => s.is_guest && s.status === 'active');

  if (subscriptionsLoaded && !hasOwnActiveSubscription && subscriptions.length === 0) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none lg:w-96 lg:h-96">
          <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
        </div>
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-kore-red/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark mb-3">
            Bienvenido/a, {user.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-kore-gray-dark/60 mb-2 leading-relaxed">
            Tu cuenta está lista. Para comenzar tu transformación y acceder a todas las funciones de KÓRE, activa tu plan.
          </p>
          <p className="text-xs text-kore-gray-dark/40 mb-8">
            Sesiones, evaluaciones, calendario y más — todo disponible con tu plan activo.
          </p>
          <Link
            href="/programs"
            className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-8 py-3.5 rounded-xl transition-colors text-sm"
          >
            Ver programas
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </div>
      </section>
    );
  }

  // ── Shared session card content ────────────────────────────
  const SessionCard = ({ className = '' }: { className?: string }) => (
    <div
      className={`rounded-[22px] p-5 text-white flex flex-col ${className}`}
      style={{ background: 'linear-gradient(135deg, #9A0526 0%, #AB0D2F 100%)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] text-white/55 uppercase tracking-[0.14em] font-semibold">
          Próxima sesión presencial
        </p>
        {sessionInDays !== null && (
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            en {sessionInDays}d
          </span>
        )}
      </div>
      <p className="font-heading text-[20px] xl:text-[28px] font-semibold text-white capitalize leading-tight mb-1">
        {formattedDate ?? 'Sin sesión agendada'}
      </p>
      {formattedDate && (
        <p className="text-[13px] xl:text-[14px] text-white/85 mb-3">
          {formattedTime}{trainerName ? ` · con ${trainerName.split(' ')[0]}` : ''}
        </p>
      )}
      {trainerName && (
        <div className="py-3 my-1 flex-1" style={{ borderTop: '1px solid rgba(255,255,255,0.18)', borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
          <p className="text-[11px] text-white/55 font-semibold uppercase tracking-[0.1em] mb-1">Coach</p>
          <p className="text-[14px] text-white font-semibold">{trainerName}</p>
        </div>
      )}
      <p className="text-[12px] text-white/70 flex-1 mt-2 leading-relaxed">
        {upcomingReminder?.session_objective ?? 'Continúa tu transformación'}
      </p>
    </div>
  );


  return (
    <section className="min-h-screen bg-kore-cream relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] pointer-events-none lg:w-96 lg:h-96">
        <Image src="/images/flower_leaves.webp" alt="" fill className="object-contain" />
      </div>

      <UpcomingSessionReminder />
      <SubscriptionExpiryReminder />
      <SubscriptionDashboardToast />

      {/* ════════════════ MOBILE LAYOUT ════════════════ */}
      <div className="xl:hidden px-5 pt-20 pb-24 space-y-3.5">

        {/* Header */}
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-1.5">
            Tu espacio
          </p>
          <h1 className="font-heading text-[22px] font-semibold text-kore-wine-dark leading-tight">
            {getGreeting()},<br />{user.name.split(' ')[0]}.
          </h1>
        </div>

        {/* Streak strip */}
        <div className="flex items-stretch gap-2">
          <div
            className="flex-1 rounded-2xl px-3.5 py-2.5"
            style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(229,229,229,0.5)' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Flame className="w-[18px] h-[18px] text-kore-red" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-kore-gray-dark">
                  {streakCount} <span className="font-normal text-kore-gray-dark/55">días seguidos</span>
                </span>
              </div>
              <span className="text-[10px] text-kore-gray-dark/45 tabular-nums font-semibold">
                {streakCount}/{longestStreak || '—'}
              </span>
            </div>
            <div className="h-1 bg-kore-gray-dark/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${longestStreak > 0 ? Math.min((streakCount / longestStreak) * 100, 100) : 0}%`,
                  background: 'linear-gradient(to right, #E00000, #9A0526)',
                }}
              />
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-2xl px-3 shrink-0"
            style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(229,229,229,0.5)' }}
            aria-label="Récord de racha"
          >
            <Trophy className="w-4 h-4 text-amber-500" strokeWidth={2} />
            <span className="text-[14px] font-bold text-kore-gray-dark tabular-nums">
              {longestStreak || '—'}
            </span>
          </div>
          {koreIndex?.kore_score !== null && koreIndex?.kore_score !== undefined && (
            <Link
              href="/my-diagnosis"
              className="flex items-center gap-1.5 rounded-2xl px-3 shrink-0 hover:bg-white/70 transition-colors active:scale-95"
              style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(229,229,229,0.5)' }}
              aria-label="Tu calificación KÓRE"
            >
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/55">KÓRE</span>
              <span className={`text-[14px] font-bold tabular-nums ${scoreColorClass}`}>
                {koreIndex.kore_score}
              </span>
            </Link>
          )}
        </div>

        <TrainerMessageBanner />

        {/* Hero */}
        {hasRoutine ? (
          <AnimatedHero>
            <div className="block p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold mb-1.5">
                    {dayLabel} · Día {todayProgDay?.day_number}
                  </p>
                  <p className="font-heading text-[26px] font-semibold text-white leading-tight">
                    ¿Listo para entrenar?
                  </p>
                  <p className="text-[13px] text-white/65 mt-1">
                    {exerciseCount} ejercicios · ~{estimatedMin} min
                  </p>
                </div>
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#E00000', boxShadow: '0 4px 14px rgba(224,0,0,0.5)' }}
                >
                  <Play className="w-[18px] h-[18px] text-white ml-0.5" fill="white" strokeWidth={0} />
                </div>
              </div>
              <div className="border-t border-white/10 pt-3.5 space-y-0">
                {previewExercises.map((ex, i) => (
                  <div
                    key={ex.id}
                    className="flex items-center gap-2.5 py-1.5"
                    style={{ borderBottom: i < previewExercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    <span className="text-[13px] text-white/35 w-5 text-right shrink-0 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-[13px] text-white/85 truncate">{ex.exercise.name}</span>
                    <span className="text-[12px] text-white/45 shrink-0">
                      {ex.sets}×{ex.reps !== null ? ex.reps : `${ex.duration_seconds}s`}
                    </span>
                  </div>
                ))}
                {exerciseCount > 4 && (
                  <p className="text-[11px] text-white/40 mt-2">+{exerciseCount - 4} ejercicios más</p>
                )}
              </div>
              {nutritionTotal > 0 && (
                <Link
                  href="/my-nutrition"
                  className="block mt-4 pt-3.5 border-t border-white/10 hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold">Nutrición de hoy</p>
                    <span className="text-[11px] font-semibold text-white/75 tabular-nums">
                      {nutritionCompleted}<span className="text-white/40">/{nutritionTotal}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mealEntries.map((entry) => {
                      const done = entry.status === 'completed';
                      return (
                        <span
                          key={entry.id}
                          className={`flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-full ${
                            done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-white/40'
                          }`}
                        >
                          {done && <Check className="w-[10px] h-[10px]" strokeWidth={2.5} />}
                          {mealLabels[entry.meal_block] ?? entry.meal_block}
                        </span>
                      );
                    })}
                  </div>
                </Link>
              )}
              <div className="mt-4 space-y-2">
                <Link
                  href="/mi-programa/hoy?start=1"
                  className="w-full h-12 bg-kore-red rounded-xl flex items-center justify-center gap-2 font-semibold text-[14px] text-white hover:bg-[#C20000] transition-colors active:scale-95"
                >
                  Iniciar rutina <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </Link>
                <Link
                  href="/book-session"
                  className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-medium text-[13px] text-white/85 hover:bg-white/[0.12] transition-colors active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
                >
                  <Calendar className="w-3.5 h-3.5" strokeWidth={2} /> Agendar sesión
                </Link>
              </div>
            </div>
          </AnimatedHero>
        ) : (
          <AnimatedHero>
            <div className="p-5 py-8 text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold mb-3">
                Hoy · {todayProgDay?.day_type === 'active_rest' ? 'Descanso activo' : 'Descanso'}
              </p>
              <p className="font-heading text-[22px] font-semibold text-white">Día de recuperación</p>
              <p className="text-[13px] text-white/55 mt-2">Descansa, estira y prepárate para mañana.</p>
            </div>
          </AnimatedHero>
        )}

        {/* Evaluation cards */}
        <RealEvalGrid
          posturoEvals={posturoEvals}
          anthroEvals={anthroEvals}
          physicalEvals={physicalEvals}
          parqAssessments={parqAssessments}
          todayMood={todayMood}
          motivationMessage={koreIndex?.kore_message}
          gridClass="grid-cols-2"
        />

        {/* Next session */}
        {!isGuestDashboard && <SessionCard />}

        {/* Mi progreso + Resumen mensual */}
        <ProgressTabsCard />
      </div>

      {/* ════════════════ DESKTOP LAYOUT ════════════════ */}
      <div className="hidden xl:block px-10 pt-8 pb-16">

        {/* Header + streak */}
        <div className="flex items-end justify-between mb-7 gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-1.5">
              Tu espacio
            </p>
            <h1 className="font-heading text-[32px] font-semibold text-kore-wine-dark leading-tight">
              {getGreeting()}, {user.name.split(' ')[0]}.
            </h1>
            <p className="text-[14px] text-kore-gray-dark/55 mt-1.5">
              {todayProgDay ? `Día ${todayProgDay.day_number} de ${activeProgram?.days.length}` : 'Sin programa activo'} · {streakCount} días consecutivos
            </p>
          </div>
          <div className="flex items-stretch gap-2 shrink-0">
            <div
              className="rounded-xl px-3.5 py-2 min-w-[180px]"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(229,229,229,0.6)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-kore-red" strokeWidth={2} />
                  <span className="text-[13px] font-semibold text-kore-gray-dark">{streakCount} días</span>
                </div>
                <span className="text-[10px] text-kore-gray-dark/45 tabular-nums font-semibold">
                  {streakCount}/{longestStreak || '—'}
                </span>
              </div>
              <div className="h-1 bg-kore-gray-dark/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${longestStreak > 0 ? Math.min((streakCount / longestStreak) * 100, 100) : 0}%`,
                    background: 'linear-gradient(to right, #E00000, #9A0526)',
                  }}
                />
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-xl px-3"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(229,229,229,0.6)' }}
              aria-label="Récord de racha"
            >
              <Trophy className="w-4 h-4 text-amber-500" strokeWidth={2} />
              <span className="text-[14px] font-bold text-kore-gray-dark tabular-nums">
                {longestStreak || '—'}
              </span>
            </div>
            {koreIndex?.kore_score !== null && koreIndex?.kore_score !== undefined && (
              <Link
                href="/my-diagnosis"
                className="flex items-center gap-1.5 rounded-xl px-3 hover:bg-white/70 transition-colors active:scale-95"
                style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(229,229,229,0.6)' }}
                aria-label="Tu calificación KÓRE"
              >
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/55">KÓRE</span>
                <span className={`text-[14px] font-bold tabular-nums ${scoreColorClass}`}>
                  {koreIndex.kore_score}
                </span>
              </Link>
            )}
          </div>
        </div>

        <TrainerMessageBanner />

        {/* Row 1: Hero (8) + Sesión (4) */}
        <div className="grid grid-cols-12 gap-5 mb-5">
          <div className="col-span-8">
            <AnimatedHero>
              {hasRoutine ? (
                <div className="grid gap-7 p-8" style={{ gridTemplateColumns: '1fr 300px' }}>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold mb-3">
                      {dayLabel} · Día {todayProgDay?.day_number}
                    </p>
                    <h2
                      className="font-heading text-[42px] font-bold text-white mb-2.5"
                      style={{ lineHeight: 1.05 }}
                    >
                      ¿Listo para<br />entrenar?
                    </h2>
                    <p className="text-[14px] text-white/65 mb-6">
                      {exerciseCount} ejercicios · ~{estimatedMin} min
                    </p>
                    <div className="flex gap-2.5">
                      <Link
                        href="/mi-programa/hoy?start=1"
                        className="h-[50px] px-6 bg-kore-red text-white rounded-xl font-semibold text-[14px] flex items-center gap-2 hover:bg-[#C20000] transition-colors active:scale-95"
                        style={{ boxShadow: '0 6px 16px rgba(224,0,0,0.4)' }}
                      >
                        <Play className="w-4 h-4" fill="white" strokeWidth={0} /> Iniciar rutina
                      </Link>
                      <Link
                        href="/book-session"
                        className="h-[50px] px-[18px] text-white rounded-xl font-medium text-[13px] flex items-center gap-2 hover:bg-white/[0.12] transition-colors active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
                      >
                        <Calendar className="w-3.5 h-3.5" strokeWidth={2} /> Agendar sesión
                      </Link>
                    </div>
                    {nutritionTotal > 0 && (
                      <Link
                        href="/my-nutrition"
                        className="block mt-6 pt-5 border-t border-white/10 hover:opacity-90 transition-opacity"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold">Nutrición de hoy</p>
                          <span className="text-[12px] font-semibold text-white/75 tabular-nums">
                            {nutritionCompleted}<span className="text-white/40"> / {nutritionTotal}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {mealEntries.map((entry) => {
                            const done = entry.status === 'completed';
                            return (
                              <span
                                key={entry.id}
                                className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                                  done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-white/40'
                                }`}
                              >
                                {done && <Check className="w-[11px] h-[11px]" strokeWidth={2.5} />}
                                {mealLabels[entry.meal_block] ?? entry.meal_block}
                              </span>
                            );
                          })}
                        </div>
                      </Link>
                    )}
                  </div>
                  <div style={{ borderLeft: '1px solid rgba(255,255,255,0.10)', paddingLeft: 24 }}>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] mb-2.5">En esta sesión</p>
                    <div className="space-y-0">
                      {allExercises.slice(0, 8).map((ex, i) => (
                        <div key={ex.id} className="flex items-center gap-2.5 py-1.5">
                          <span className="text-[11px] text-white/30 w-5 text-right shrink-0 tabular-nums">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="flex-1 text-[12px] text-white/82 truncate min-w-0">{ex.exercise.name}</span>
                          <span className="text-[11px] text-white/40 shrink-0">
                            {ex.sets}×{ex.reps !== null ? ex.reps : `${ex.duration_seconds}s`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8">
                  <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold mb-3">Hoy</p>
                  <h2 className="font-heading text-[42px] font-bold text-white" style={{ lineHeight: 1.05 }}>
                    Día de descanso
                  </h2>
                  <p className="text-[14px] text-white/55 mt-2">Descansa, hidrátate y prepárate para mañana.</p>
                </div>
              )}
            </AnimatedHero>
          </div>

          <div className="col-span-4">
            {!isGuestDashboard ? (
              <SessionCard className="h-full" />
            ) : (
              <div className="rounded-[22px] p-6 bg-white/70 border border-white/60 h-full flex items-center justify-center text-center">
                <p className="text-sm text-kore-gray-dark/40">Modo invitado activo</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Mi Progreso / Resumen (full width) */}
        <div className="mb-5">
          <ProgressTabsCard />
        </div>

        {/* Row 3: Evaluation cards */}
        {(posturoEvals.length > 0 || anthroEvals.length > 0 || physicalEvals.length > 0) && (
          <div className="mb-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-2.5">
              Resultados de tus evaluaciones
            </p>
            <RealEvalGrid
              posturoEvals={posturoEvals}
              anthroEvals={anthroEvals}
              physicalEvals={physicalEvals}
              parqAssessments={parqAssessments}
              todayMood={todayMood}
              motivationMessage={koreIndex?.kore_message}
              gridClass="grid-cols-4"
            />
          </div>
        )}

      </div>
    </section>
  );
}
