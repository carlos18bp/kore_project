'use client';

interface Props {
  label: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  unit?: string;
  lowerIsBetter?: boolean;
  decimals?: number;
}

export default function ComparisonCard({ label, before, after, delta, unit = '', lowerIsBetter = false, decimals = 1 }: Props) {
  const improved = delta !== null ? (lowerIsBetter ? delta < 0 : delta > 0) : null;
  const neutral = delta !== null && delta === 0;

  const deltaColor = neutral
    ? 'text-amber-500'
    : improved
    ? 'text-teal-600'
    : 'text-rose-500';

  const fmt = (v: number | null) => (v === null ? '—' : `${v.toFixed(decimals)}${unit}`);

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
      <p className="text-xs text-kore-gray-dark/50 uppercase tracking-wide font-semibold mb-3">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] text-kore-gray-dark/40 mb-0.5">Inicio</p>
          <p className="text-lg font-bold text-kore-gray-dark">{fmt(before)}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          {delta !== null ? (
            <span className={`text-sm font-bold ${deltaColor}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(decimals)}{unit}
            </span>
          ) : (
            <span className="text-xs text-kore-gray-dark/30">sin datos</span>
          )}
          <svg className="w-5 h-2 text-kore-gray-dark/20" fill="none" viewBox="0 0 20 8">
            <path d="M0 4h16m0 0l-4-3m4 3l-4 3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-kore-gray-dark/40 mb-0.5">Fin</p>
          <p className={`text-lg font-bold ${improved === null ? 'text-kore-gray-dark' : improved ? 'text-teal-600' : 'text-rose-500'}`}>{fmt(after)}</p>
        </div>
      </div>
    </div>
  );
}
