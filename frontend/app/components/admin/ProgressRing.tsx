type Props = {
  used: number;
  total: number;
  size?: number;
  label?: string;
};

export default function ProgressRing({ used, total, size = 140, label = 'Sesiones' }: Props) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(231,200,160,0.20)" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="url(#kore-ring-grad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
        <defs>
          <linearGradient id="kore-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F4C7C7" />
            <stop offset="100%" stopColor="#E00000" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-heading text-[32px] font-semibold text-kore-ivory leading-none">
          {used}
          <span className="text-[18px] text-kore-gold">/{total}</span>
        </div>
        <div className="text-[9px] font-bold uppercase tracking-[0.20em] text-kore-gold/65 mt-1">
          {label}
        </div>
      </div>
    </div>
  );
}
