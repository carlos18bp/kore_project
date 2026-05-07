type Tone = 'dark' | 'sakura' | 'sage' | 'amber';

type Props = {
  kicker: string;
  value: number | string;
  hint?: string;
  tone?: Tone;
  badge?: boolean;
  loading?: boolean;
};

const ACCENT_BLOB: Record<Exclude<Tone, 'dark'>, string> = {
  sakura: 'bg-kore-petal/40',
  sage: 'bg-kore-sage/40',
  amber: 'bg-kore-amber/40',
};

export default function StatTile({ kicker, value, hint, tone = 'dark', badge, loading }: Props) {
  if (tone === 'dark') {
    return (
      <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-kore-gold/15 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-gold">
            {kicker}
          </div>
          {badge && <span className="w-2 h-2 rounded-full bg-kore-amber animate-pulse-dot" />}
        </div>
        <div className="font-heading text-[38px] font-semibold text-kore-ivory mt-2 leading-none">
          {loading ? <span className="inline-block w-12 h-9 bg-white/10 rounded-md animate-pulse" /> : value}
        </div>
        {hint && <div className="text-[11px] text-kore-ivory/65 mt-1.5">{hint}</div>}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm">
      <div
        aria-hidden
        className={`absolute -top-3 -right-3 w-16 h-16 rounded-full opacity-30 blur-lg ${ACCENT_BLOB[tone]}`}
      />
      <div className="relative flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
          {kicker}
        </div>
        {badge && <span className="w-2 h-2 rounded-full bg-kore-amber animate-pulse-dot" />}
      </div>
      <div className="relative font-heading text-[38px] font-semibold text-kore-burgundy mt-2 leading-none">
        {loading ? <span className="inline-block w-12 h-9 bg-kore-burgundy/10 rounded-md animate-pulse" /> : value}
      </div>
      {hint && <div className="relative text-[11px] text-kore-burgundy/60 mt-1.5">{hint}</div>}
    </div>
  );
}
