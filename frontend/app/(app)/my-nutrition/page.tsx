'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Camera, Check } from 'lucide-react';
import { useNutritionStore, type NutritionHabit } from '@/lib/stores/nutritionStore';
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyNutritionPage() {
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [uploadingMealId, setUploadingMealId] = useState<number | null>(null);
  const [waterDrank, setWaterDrank] = useState(0);
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
      <div className="w-full px-5 xl:px-10 pt-20 xl:pt-8 pb-24">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-1">Mi Nutrición</p>
          <h1 className="font-heading text-[22px] font-semibold text-kore-wine-dark leading-tight capitalize">{dateLabel}</h1>
        </div>

        {/* ── AnimatedHero ────────────────────────────────────────────────────── */}
        {dailyLoading && !todayLog ? (
          <div className="relative overflow-hidden rounded-[22px] shadow-2xl flex justify-center items-center" style={{ background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #0b1220 100%)', minHeight: 200 }}>
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
          </div>
        ) : !todayLog ? (
          <div className="relative overflow-hidden rounded-[22px] shadow-2xl text-center py-14 px-8" style={{ background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #0b1220 100%)' }}>
            {/* Orbs */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(154,5,38,0.25) 0%, transparent 50%), radial-gradient(ellipse at 10% 90%, rgba(106,4,26,0.3) 0%, transparent 55%)', animation: 'kore-aurora 8s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ top: '20%', right: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,0,0,0.4) 0%, rgba(171,13,47,0.13) 50%, transparent 70%)', filter: 'blur(30px)', animation: 'kore-orb-1 9s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ bottom: '10%', left: '20%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(154,5,38,0.33) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'kore-orb-2 11s ease-in-out infinite' }} />
            <div className="relative z-10 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Mi nutrición · Hoy</p>
              <h2 className="font-heading text-2xl font-bold text-white">Sin plan activo</h2>
              <p className="text-sm text-white/65 leading-relaxed">Necesitas un programa mensual activo para ver tu plan nutricional del día.</p>
              <Link href="/mi-programa" className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-kore-red text-white text-sm font-semibold active:scale-95 transition-transform">
                Ver mi programa →
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[22px] shadow-2xl" style={{ background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #0b1220 100%)', minHeight: 280 }}>
            {/* Aurora + Orbs */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(154,5,38,0.25) 0%, transparent 50%), radial-gradient(ellipse at 10% 90%, rgba(106,4,26,0.3) 0%, transparent 55%)', animation: 'kore-aurora 8s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ top: '20%', right: '8%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,0,0,0.4) 0%, rgba(171,13,47,0.13) 50%, transparent 70%)', filter: 'blur(30px)', animation: 'kore-orb-1 9s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ bottom: '10%', left: '20%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(154,5,38,0.33) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'kore-orb-2 11s ease-in-out infinite' }} />
            <div className="absolute pointer-events-none" style={{ top: '50%', left: '50%', width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(205,12,54,0.27) 0%, transparent 70%)', filter: 'blur(35px)', animation: 'kore-orb-3 7s ease-in-out infinite' }} />

            {/* Habits button — absolute top-left of hero card */}
            <Link
              href="/mi-nutricion-diaria"
              className="absolute top-4 left-4 z-20 text-[11px] font-semibold px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Actualizar hábitos
            </Link>

            {/* Content grid: 1fr 200px on desktop, stacked on mobile */}
            <div className="relative z-10 p-7 xl:p-9 flex flex-col xl:grid xl:items-center gap-7 xl:gap-9" style={{ gridTemplateColumns: '1fr 220px' }}>
              {/* Left */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Mi nutrición · Hoy</p>
                <h2 className="font-heading text-[28px] xl:text-[38px] font-bold text-white mt-3 leading-[1.05]">Tu día, en equilibrio.</h2>
                <p className="text-sm text-white/75 mt-2.5 leading-relaxed">
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

            </div>

            {/* ── Right sidebar (5 cols) ──────────────────────────────────────── */}
            <div className="xl:col-span-5 flex flex-col gap-4">

              {/* Water tracker */}
              <div className="relative overflow-hidden rounded-[18px]" style={{ background: 'linear-gradient(135deg, #0b1220 0%, #1e3a5f 100%)', padding: 24, boxShadow: '0 8px 24px -10px rgba(0,0,0,0.35)' }}>
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

              {/* Habits radial — below water */}
              {latest && habitScore !== null && (() => {
                const arcR = 36;
                const arcCirc = 2 * Math.PI * arcR;
                const arcOffset = arcCirc * (1 - Math.min(habitScore / 10, 1));
                const { strengths, improvements } = analyzeHabits(latest);
                return (
                  <div className="bg-white rounded-[18px] border border-kore-gray-light/60 shadow-sm" style={{ padding: 22 }}>
                    <div className="flex items-baseline justify-between mb-3.5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/42">Hábitos · esta semana</p>
                      <span className="text-[11px] font-semibold" style={{ color: '#10B981' }}>↑ adherencia</span>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative flex-shrink-0" style={{ width: 88, height: 88 }}>
                        <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
                          <defs>
                            <linearGradient id="habit-grad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#670F22" />
                              <stop offset="100%" stopColor="#AB0D2F" />
                            </linearGradient>
                          </defs>
                          <circle cx="44" cy="44" r={arcR} fill="none" stroke="rgba(51,51,51,0.08)" strokeWidth="9" />
                          <circle cx="44" cy="44" r={arcR} fill="none" stroke={habitColorStroke} strokeWidth="9" strokeLinecap="round" strokeDasharray={arcCirc} strokeDashoffset={arcOffset} style={{ transition: 'stroke-dashoffset 700ms ease-out' }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[22px] font-bold text-kore-gray-dark leading-none">{habitScore.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[17px] font-bold text-kore-wine-dark leading-tight">{latest.habit_category}</p>
                        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'rgba(51,51,51,0.6)' }}>
                          Adherencia registrada. Revisa tus hábitos para potenciar tu proceso.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5" style={{ color: '#10B981' }}>Fortalezas</p>
                        {strengths.map(s => (
                          <div key={s.label} className="flex items-center gap-1.5 py-[3px]">
                            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
                            <span className="text-[12px] text-kore-gray-dark">{s.label}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5" style={{ color: '#F59E0B' }}>Mejorar</p>
                        {improvements.map(s => (
                          <div key={s.label} className="flex items-center gap-1.5 py-[3px]">
                            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />
                            <span className="text-[12px] text-kore-gray-dark">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Weekly metrics */}
              {latest && (() => {
                const water = parseFloat(latest.water_liters);
                const metrics: [string, string, string][] = [
                  ['Comidas/día', String(latest.meals_per_day), (latest.meals_per_day >= 3 && latest.meals_per_day <= 5) ? '#10B981' : '#F59E0B'],
                  ['Agua', `${water}L`, water >= 2 ? '#10B981' : '#F59E0B'],
                  ['Frutas', String(latest.fruit_weekly), latest.fruit_weekly >= 7 ? '#10B981' : '#F59E0B'],
                  ['Verduras', String(latest.vegetable_weekly), latest.vegetable_weekly >= 7 ? '#10B981' : '#F59E0B'],
                  ['Ultraproc.', String(latest.ultraprocessed_weekly), latest.ultraprocessed_weekly <= 3 ? '#10B981' : '#F59E0B'],
                  ['Bebidas az.', String(latest.sugary_drinks_weekly), latest.sugary_drinks_weekly <= 2 ? '#10B981' : '#F59E0B'],
                ];
                return (
                  <div className="bg-white rounded-[18px] border border-kore-gray-light/60 shadow-sm" style={{ padding: 22 }}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/42 mb-3">Tu registro · 7 días</p>
                    <div className="grid grid-cols-3 gap-2">
                      {metrics.map(([label, value, color]) => (
                        <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(102,15,34,0.03)' }}>
                          <p className="text-[10px] text-kore-gray-dark/55 truncate">{label}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[17px] font-bold text-kore-gray-dark leading-none">{value}</span>
                            <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Food diary ──────────────────────────────────────────────────────── */}
        {photoEntries.length > 0 && (
          <div className="mt-7">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/42">Tu diario fotográfico</p>
                <p className="text-xs text-kore-gray-dark/55 mt-0.5">Tu coach revisa tus fotos cada lunes.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-2.5">
              {photoEntries.map((m) => (
                <div key={m.id} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1', background: '#1e293b', cursor: 'pointer' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.photo_url!} alt={BLOCK_LABEL[m.meal_block]} className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)' }} />
                  <div className="absolute bottom-2 left-2.5 right-2.5">
                    <p className="text-[10px] font-semibold text-white/75 uppercase tracking-[0.08em] truncate">{BLOCK_LABEL[m.meal_block]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>
    </section>
  );
}
