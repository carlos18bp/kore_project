'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';

function Chip({ amount, suffix }: { amount: number | null; suffix?: string }) {
  if (amount === null) return null;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-kore-red/10 text-kore-red flex-shrink-0">
      +{amount}{suffix ?? ''}
    </span>
  );
}

function Row({ label, detail, done, chip, href, onClick }: {
  label: string; detail: string; done: boolean;
  chip: React.ReactNode; href?: string; onClick?: () => void;
}) {
  const body = (
    <>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-kore-sage/25 text-kore-sage-deep' : 'bg-kore-cream text-kore-gray-dark/30'}`}>
        {done ? <Check className="w-3.5 h-3.5" strokeWidth={2} /> : <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />}
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[13px] font-semibold text-kore-gray-dark truncate">{label}</span>
        <span className="block text-[11px] text-kore-gray-dark/45 truncate">{detail}</span>
      </span>
      {chip}
    </>
  );
  const cls = 'w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-kore-cream/50 transition-colors';
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <Link href={href ?? '#'} className={cls}>{body}</Link>;
}

export default function TodayCreditsCard() {
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
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm" data-testid="today-credits-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-2 px-2">
        Hoy ganas
      </p>
      <div className="space-y-0.5">
        <Row
          label="Check-in diario"
          detail={todayMood ? 'Completado' : 'Cuéntanos cómo estás'}
          done={!!todayMood}
          chip={<Chip amount={value('checkin')} />}
          onClick={todayMood ? undefined : openMoodModal}
          href={todayMood ? '#' : undefined}
        />
        <Row
          label="Hidratación"
          detail={`${glasses}/${waterGoalGlasses} vasos`}
          done={loaded && glasses >= waterGoalGlasses}
          chip={<Chip amount={value('water_goal')} />}
          href="/my-nutrition"
        />
        <Row
          label="Comidas con foto"
          detail={`${mealsWithPhoto}/5 registradas`}
          done={mealsWithPhoto >= 5}
          chip={<Chip amount={value('meal_photo')} suffix=" c/u" />}
          href="/my-nutrition"
        />
        <Row
          label="Rutina de hoy"
          detail={exerciseLogs.length === 0 ? 'Sin rutina hoy' : exercisesDone === exerciseLogs.length ? 'Completada · en validación' : `${exercisesDone}/${exerciseLogs.length} ejercicios`}
          done={exerciseLogs.length > 0 && exercisesDone === exerciseLogs.length}
          chip={<Chip amount={value('workout_day')} />}
          href="/mi-programa/rutina"
        />
      </div>
    </div>
  );
}
