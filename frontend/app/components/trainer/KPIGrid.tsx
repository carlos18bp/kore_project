type KPIItem = {
  label: string;
  value: string | number | null;
  unit?: string;
  color?: string;
};

type Props = {
  items: KPIItem[];
  columns?: 2 | 3;
};

export default function KPIGrid({ items, columns = 2 }: Props) {
  const gridClass = columns === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-3`}>
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm flex flex-col gap-1"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-kore-gray-dark/40">
            {item.label}
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-black tracking-tight leading-none"
              style={{ color: item.color ?? 'var(--color-kore-gray-dark)' }}
            >
              {item.value ?? '—'}
            </span>
            {item.unit && item.value !== null && (
              <span className="text-xs text-kore-gray-dark/40 font-medium">{item.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
