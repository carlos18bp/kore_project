'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTrainerEngagementStore } from '@/lib/stores/trainerEngagementStore';
import RatingsSummaryCard from '@/app/components/trainer/RatingsSummaryCard';

const pct = (v: number | null) => (v == null ? '—' : `${v}%`);
const num = (v: number | null) => (v == null ? '—' : String(v));

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-kore-gray-dark/50">{label}</div>
      <div className="font-heading text-3xl font-semibold text-kore-gray-dark mt-1 leading-none">{value}</div>
    </div>
  );
}

export default function TrainerEngagementView() {
  const { data, error, fetchEngagement } = useTrainerEngagementStore();

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  const s = data?.summary;
  const roster = data?.roster ?? [];

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-0.5">Inteligencia</p>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark">Engagement de tu cartera</h1>
        </div>

        {error && <p className="text-sm text-kore-red">{error}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Rachas activas" value={num(s?.active_streaks ?? 0)} />
          <Tile label="Check-in hoy" value={pct(s?.checked_in_today_pct ?? 0)} />
          <Tile label="Créditos 30d" value={`+${s?.credits_earned_30d ?? 0} / -${s?.credits_spent_30d ?? 0}`} />
          <Tile label="Asistencia 30d" value={pct(s?.attendance_rate_30d ?? null)} />
        </div>

        <RatingsSummaryCard />

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
          <h2 className="text-sm font-bold text-kore-gray-dark mb-3">Tus clientes</h2>
          {roster.length === 0 ? (
            <p className="text-sm text-kore-gray-dark/50">Sin clientes todavía.</p>
          ) : (
            <ul className="divide-y divide-kore-gray-light/40">
              {roster.map((r) => (
                <li key={r.customer_id}>
                  <Link
                    href={`/trainer/clients/client?id=${r.customer_id}`}
                    prefetch={false}
                    className="flex items-center justify-between py-3 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-sm font-semibold text-kore-gray-dark">{r.name}</span>
                    <span className="text-xs text-kore-gray-dark/60 flex gap-3">
                      <span>🔥 {r.current_streak}</span>
                      <span>Asist. {pct(r.attendance_rate_30d)}</span>
                      <span>★ {num(r.average_rating)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
