type Datum = { month: string; cop: number };

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Short 'feb'/'mar' label from a 'YYYY-MM' key. */
function shortMonth(key: string): string {
  const m = Number(key.slice(5, 7));
  return MONTHS_ES[m - 1] ?? key;
}

export default function TrendBars({ data }: { data: Datum[] }) {
  const max = Math.max(0, ...data.map((d) => d.cop));
  return (
    <div data-testid="trend-bars" className="flex items-end gap-2 h-24">
      {data.map((d) => {
        const pct = max > 0 ? Math.round((d.cop / max) * 100) : 0;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex-1 flex items-end rounded-t-md bg-kore-red/10">
              <div
                data-bar
                className="w-full rounded-t-md bg-kore-red transition-all duration-700"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-kore-burgundy/50">{shortMonth(d.month)}</span>
          </div>
        );
      })}
    </div>
  );
}
