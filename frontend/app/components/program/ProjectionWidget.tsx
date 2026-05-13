'use client';

import type { Projection } from '@/lib/stores/progressStore';

const TREND_ICON: Record<string, string> = {
  improving: '↗',
  stable: '→',
  declining: '↘',
};

const TREND_COLOR: Record<string, string> = {
  improving: 'text-teal-600',
  stable: 'text-amber-500',
  declining: 'text-rose-500',
};

const TREND_LABEL: Record<string, string> = {
  improving: 'Mejorando',
  stable: 'Estable',
  declining: 'Bajando',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Alta confianza',
  medium: 'Confianza media',
  low: 'Pocos datos aún',
};

interface Props {
  projection: Projection;
}

export default function ProjectionWidget({ projection }: Props) {
  const pct = Math.round(projection.projected_final_adherence * 100);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wide font-semibold">Proyección final</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-sm font-bold ${TREND_COLOR[projection.trend]}`}>
              {TREND_ICON[projection.trend]} {TREND_LABEL[projection.trend]}
            </span>
            <span className="text-xs text-kore-gray-dark/30">· {CONFIDENCE_LABEL[projection.confidence]}</span>
          </div>
        </div>
        {/* Circular progress */}
        <div className="relative shrink-0">
          <svg width={68} height={68} viewBox="0 0 68 68">
            <circle cx={34} cy={34} r={28} fill="none" stroke="#f5e6e8" strokeWidth={6} />
            <circle
              cx={34} cy={34} r={28}
              fill="none"
              stroke="#C2001F"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 34 34)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-kore-gray-dark">{pct}%</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-kore-gray-dark/60 leading-relaxed mb-3">{projection.recommendation}</p>

      <div className="flex items-center gap-3 text-xs text-kore-gray-dark/40">
        <span>{projection.days_elapsed} días registrados</span>
        <span className="w-px h-3 bg-kore-gray-dark/20" />
        <span>{projection.days_remaining} días restantes</span>
        {projection.weight_projection && (
          <>
            <span className="w-px h-3 bg-kore-gray-dark/20" />
            <span>{projection.weight_projection} kg proyectado</span>
          </>
        )}
      </div>
    </div>
  );
}
