'use client';

import { useEffect } from 'react';
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';

/** The feedback customers left on this trainer's sessions. */
export default function RatingsSummaryCard({ customerId }: { customerId?: number }) {
  const summary = useSessionRatingStore((s) => s.summary);
  const fetchSummary = useSessionRatingStore((s) => s.fetchSummary);

  useEffect(() => {
    fetchSummary(customerId);
  }, [fetchSummary, customerId]);

  return (
    <div
      data-testid={customerId ? 'client-ratings' : 'ratings-summary'}
      className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm space-y-3"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-kore-gray-dark">Calificaciones</h3>
        <span className="text-xs text-kore-gray-dark/40">
          {summary?.count ?? 0} sesión(es)
        </span>
      </div>

      {summary?.average != null ? (
        <p className="text-4xl font-black tracking-tight text-kore-red">
          {summary.average.toFixed(1)}
          <span className="text-base font-semibold text-kore-gray-dark/40"> / 5</span>
        </p>
      ) : (
        <p className="text-sm text-kore-gray-dark/50">Todavía no hay calificaciones.</p>
      )}

      {!!summary?.recent.length && (
        <ul className="space-y-2">
          {summary.recent
            .filter((r) => r.comment)
            .map((r, i) => (
              <li key={i} className="text-xs text-kore-gray-dark/80 leading-relaxed">
                <span className="font-semibold text-kore-gray-dark">{r.score}★</span> {r.comment}
                <span className="text-kore-gray-dark/40"> — {r.customer_name}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
