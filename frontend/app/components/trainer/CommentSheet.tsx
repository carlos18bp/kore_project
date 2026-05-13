'use client';

import { useState, useRef, useEffect } from 'react';
import type { PhotoEntry } from '@/lib/stores/trainerStore';
import Image from 'next/image';

type Props = {
  photo: PhotoEntry;
  onClose: () => void;
  onSubmit: (comment: string, flaggedForSession: boolean) => Promise<void>;
};

export default function CommentSheet({ photo, onClose, onSubmit }: Props) {
  const [comment, setComment] = useState(photo.trainer_comment ?? '');
  const [flagged, setFlagged] = useState(photo.flagged_for_session);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(comment, flagged);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const mealBlockLabel: Record<string, string> = {
    breakfast: 'Desayuno',
    morning_snack: 'Media mañana',
    lunch: 'Almuerzo',
    afternoon_snack: 'Merienda',
    dinner: 'Cena',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-white/40 backdrop-blur-md z-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90dvh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-kore-gray-light rounded-full" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Photo */}
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-kore-cream">
            <Image
              src={photo.photo_url}
              alt={`Foto de ${photo.customer_name}`}
              fill
              className="object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-3 py-2">
              <p className="text-white text-sm font-semibold">{photo.customer_name}</p>
              <p className="text-white/70 text-xs">
                {mealBlockLabel[photo.meal_block] ?? photo.meal_block} · {new Date(photo.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
              </p>
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50">
              Comentario del entrenador
            </label>
            <textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Escribe tu observación sobre esta comida..."
              className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 resize-none focus:outline-none focus:ring-2 focus:ring-kore-red/30"
            />
          </div>

          {/* Flag toggle */}
          <button
            onClick={() => setFlagged((v) => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
              flagged
                ? 'bg-kore-red/10 border-kore-red/30 text-kore-red'
                : 'bg-white border-kore-gray-light/40 text-kore-gray-dark/50'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            <span className="text-sm font-medium">Revisar en próxima sesión</span>
            <span className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              flagged ? 'border-kore-red bg-kore-red' : 'border-kore-gray-light'
            }`}>
              {flagged && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </span>
          </button>
        </div>

        {/* Footer actions */}
        <div className="px-4 pt-2 pb-6 flex gap-3 border-t border-kore-gray-light/20">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-kore-cream text-kore-gray-dark/60 text-sm font-medium active:scale-95 transition-transform duration-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-medium active:scale-95 transition-transform duration-100 disabled:opacity-60"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  );
}
