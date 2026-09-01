'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';

function Pill({ label, done, amount, href, onClick }: {
  label: string; done: boolean; amount: number | null; href?: string; onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/10 text-white/40'}`}>
        {done ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <span className="w-1 h-1 rounded-full bg-white/40" />}
      </span>
      <span className="text-[11px] font-semibold text-white/85">{label}</span>
      {amount !== null && <span className="text-[10px] font-bold text-kore-gold">+{amount}</span>}
    </>
  );
  const cls = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] transition-colors';
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <Link href={href ?? '#'} className={cls}>{inner}</Link>;
}

export default function HeroTaskPills() {
  const { todayMood, openMoodModal } = useProfileStore();
  const { todayLog, fetchTodayLog } = useNutritionDailyStore();
  const { todayData, fetchTodayData } = useProgramStore();
  const { value, waterGoalGlasses, fetchValues, loaded } = useCreditValuesStore();

  useEffect(() => { fetchValues(); }, [fetchValues]);
  useEffect(() => { if (!todayLog) fetchTodayLog(); }, [todayLog, fetchTodayLog]);
  useEffect(() => { if (!todayData) fetchTodayData(); }, [todayData, fetchTodayData]);

  const glasses = todayLog?.water_glasses?.length ?? 0;
  const mealsWithPhoto = (todayLog?.meal_entries ?? []).filter((m) => m.status === 'completed' && m.photo_url).length;
  const exerciseLogs = todayData?.daily_log?.exercise_logs ?? [];
  const exercisesDone = exerciseLogs.filter((e) => e.status === 'completed').length;

  return (
    <div className="mt-4 pt-3.5 border-t border-white/10" data-testid="hero-task-pills">
      <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold mb-2">Hoy ganas</p>
      <div className="flex flex-wrap gap-1.5">
        <Pill label="Check-in" done={!!todayMood} amount={value('checkin')} onClick={todayMood ? undefined : openMoodModal} href={todayMood ? '#' : undefined} />
        <Pill label="Hidratación" done={loaded && glasses >= waterGoalGlasses} amount={value('water_goal')} href="/my-nutrition" />
        <Pill label="Comidas" done={mealsWithPhoto >= 5} amount={value('meal_photo')} href="/my-nutrition" />
        <Pill label="Rutina" done={exerciseLogs.length > 0 && exercisesDone === exerciseLogs.length} amount={value('workout_day')} href="/mi-programa/rutina" />
      </div>
    </div>
  );
}
