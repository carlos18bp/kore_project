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
    <div className="flex items-center justify-between py-2 border-b border-kore-gray-light/30 last:border-b-0">
      <p className="text-[11px] text-kore-gray-dark/55 font-medium">{label}</p>
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] text-kore-gray-dark/45 tabular-nums">{fmt(before)}</span>
        <svg className="w-3 h-2 text-kore-gray-dark/25 shrink-0" fill="none" viewBox="0 0 12 8">
          <path d="M0 4h9m0 0l-2.5-2.5M9 4l-2.5 2.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={`text-[12px] font-semibold tabular-nums ${improved === null ? 'text-kore-gray-dark' : improved ? 'text-teal-600' : 'text-rose-500'}`}>
          {fmt(after)}
        </span>
        {delta !== null && (
          <span className={`text-[10px] font-semibold tabular-nums ${deltaColor} shrink-0 w-12 text-right`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(decimals)}{unit}
          </span>
        )}
      </div>
    </div>
  );
}
