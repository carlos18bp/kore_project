'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import MealBlockCard from '@/app/components/nutrition-daily/MealBlockCard';
import NutritionDailyProgress from '@/app/components/nutrition-daily/NutritionDailyProgress';

export default function MiNutricionDiariaPage() {
  const { todayLog, loading, fetchTodayLog, updateMealEntry, uploadMealPhoto } = useNutritionDailyStore();

  useEffect(() => {
    fetchTodayLog();
  }, [fetchTodayLog]);

  const dateLabel = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-kore-red border-t-transparent" />
      </div>
    );
  }

  if (!todayLog) {
    return (
      <main className="px-4 py-8 max-w-xl mx-auto text-center">
        <div className="rounded-2xl border border-kore-gray-light/50 p-8">
          <p className="text-3xl mb-3">🥗</p>
          <p className="font-semibold text-kore-gray-dark">Sin plan nutricional activo</p>
          <p className="text-sm text-kore-gray-dark/50 mt-1">Necesitas un programa mensual activo para ver sugerencias.</p>
          <Link href="/mi-programa" className="inline-block mt-4 text-sm text-kore-red hover:underline">← Ver mi programa</Link>
        </div>
      </main>
    );
  }

  const { id: logId, is_closed, meal_entries } = todayLog;

  return (
    <main className="px-4 py-6 max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-kore-gray-dark/50 hover:text-kore-gray-dark">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-kore-gray-dark capitalize">Mi Nutrición</h1>
          <p className="text-xs text-kore-gray-dark/40 capitalize">{dateLabel}</p>
        </div>
        {is_closed && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Día cerrado
          </span>
        )}
      </div>

      {/* Progress */}
      <NutritionDailyProgress entries={meal_entries} />

      {/* Tip */}
      {!is_closed && (
        <div className="bg-kore-red/5 rounded-xl px-4 py-3 border border-kore-red/10">
          <p className="text-xs text-kore-red/80 leading-relaxed">
            <span className="font-semibold">¿Comiste algo diferente?</span> No hay problema — marca la comida como completada y agrega una nota o foto de lo que realmente comiste.
          </p>
        </div>
      )}

      {/* Meal cards */}
      <div className="space-y-3">
        {meal_entries.map((entry) => (
          <MealBlockCard
            key={entry.id}
            entry={entry}
            logId={logId}
            isClosed={is_closed}
            onStatusChange={(mealId, status) => updateMealEntry(logId, mealId, status)}
            onPhotoUpload={(mealId, file) => uploadMealPhoto(logId, mealId, file)}
          />
        ))}
      </div>
    </main>
  );
}
