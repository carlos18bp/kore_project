'use client';

import { useEffect, useState } from 'react';
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';

/**
 * Prompts the customer to rate their most recent attended session.
 * Skipping leaves the session unrated forever — by design, we do not nag.
 */
export default function SessionRatingCard() {
  const pending = useSessionRatingStore((s) => s.pending);
  const fetchPending = useSessionRatingStore((s) => s.fetchPending);
  const submitRating = useSessionRatingStore((s) => s.submitRating);

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const session = pending[0];
  if (!session || skipped) return null;

  const handleSubmit = async () => {
    if (score < 1) return;
    setSaving(true);
    await submitRating(session.id, score, comment.trim());
    setSaving(false);
  };

  const sessionDate = new Date(session.starts_at).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
  });

  // The card owns its margins so that, when there is nothing to rate, it returns
  // null and leaves no empty padded box behind on the dashboard.
  return (
    <div
      data-testid="session-rating-card"
      className="relative z-10 mx-5 xl:mx-10 mt-6 xl:mt-8 bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3"
    >
      <div>
        <h3 className="text-sm font-bold text-kore-gray-dark">Califica tu sesión</h3>
        <p className="text-xs text-kore-gray-dark/50">
          {sessionDate}
          {session.trainer_name ? ` · con ${session.trainer_name}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`rating-star-${n}`}
            aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
            onClick={() => setScore(n)}
            className={`text-2xl leading-none transition-colors ${
              n <= score ? 'text-kore-red' : 'text-kore-gray-dark/20'
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="¿Algo que quieras contarle a tu entrenador? (opcional)"
        rows={2}
        className="w-full rounded-xl border border-kore-gray-light/60 p-3 text-sm text-kore-gray-dark/80 resize-none"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="rating-submit"
          onClick={handleSubmit}
          disabled={score < 1 || saving}
          className="bg-kore-red text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50"
        >
          {saving ? 'Enviando…' : 'Enviar'}
        </button>
        <button
          type="button"
          data-testid="rating-skip"
          onClick={() => setSkipped(true)}
          className="text-sm text-kore-gray-dark/50 px-2 py-2"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}
