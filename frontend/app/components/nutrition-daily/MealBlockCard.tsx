'use client';

import type { MealEntry } from '@/lib/stores/nutritionDailyStore';
import MealPhotoUpload from './MealPhotoUpload';

const BLOCK_ICON: Record<string, string> = {
  desayuno: '🌅',
  media_manana: '🍎',
  almuerzo: '🍽️',
  merienda: '🥤',
  cena: '🌙',
};

const BLOCK_LABEL: Record<string, string> = {
  desayuno: 'Desayuno',
  media_manana: 'Media mañana',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
};

interface Props {
  entry: MealEntry;
  logId: number;
  isClosed: boolean;
  onStatusChange: (mealId: number, status: MealEntry['status']) => void;
  onPhotoUpload: (mealId: number, file: File) => Promise<void>;
}

export default function MealBlockCard({ entry, logId, isClosed, onStatusChange, onPhotoUpload }: Props) {
  const { id, meal_block, suggestion, status, photo_url } = entry;

  const statusRing =
    status === 'completed' ? 'border-kore-red/30 bg-white/80' :
    status === 'skipped' ? 'border-gray-200 bg-gray-50/80' :
    'border-white/60 bg-white/60';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-colors ${statusRing}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{BLOCK_ICON[meal_block]}</span>
          <div>
            <p className="text-sm font-bold text-kore-gray-dark">{BLOCK_LABEL[meal_block]}</p>
            {suggestion && (
              <p className="text-xs text-kore-gray-dark/50 mt-0.5">~{suggestion.calories_estimate} kcal</p>
            )}
          </div>
        </div>
        {status === 'completed' && (
          <span className="shrink-0 w-5 h-5 rounded-full bg-kore-red flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </span>
        )}
      </div>

      {/* Suggestion */}
      {suggestion && (
        <div className="mb-3 p-3 rounded-xl bg-kore-red/5 border border-kore-red/10">
          <p className="text-xs font-semibold text-kore-red mb-0.5">Sugerencia</p>
          <p className="text-sm text-kore-gray-dark font-medium">{suggestion.title}</p>
          {suggestion.description && (
            <p className="text-xs text-kore-gray-dark/50 mt-1 leading-relaxed">{suggestion.description}</p>
          )}
        </div>
      )}

      {/* Photo */}
      {!isClosed && (
        <div className="mb-3">
          <MealPhotoUpload
            photoUrl={photo_url}
            onUpload={(file) => onPhotoUpload(id, file)}
            disabled={isClosed}
          />
        </div>
      )}
      {isClosed && photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo_url} alt="Foto comida" className="w-full h-28 object-cover rounded-xl mb-3" />
      )}

      {/* Actions */}
      {!isClosed && (
        <div className="flex gap-2">
          <button
            onClick={() => onStatusChange(id, status === 'completed' ? 'not_done' : 'completed')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              status === 'completed'
                ? 'bg-kore-red text-white'
                : 'bg-kore-red/10 text-kore-red hover:bg-kore-red/20'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {status === 'completed' ? 'Completado' : 'Comí esto'}
          </button>
          <button
            onClick={() => onStatusChange(id, status === 'skipped' ? 'not_done' : 'skipped')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              status === 'skipped'
                ? 'bg-gray-400 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            Omití
          </button>
        </div>
      )}
    </div>
  );
}
