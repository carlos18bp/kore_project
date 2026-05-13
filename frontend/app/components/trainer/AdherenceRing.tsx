'use client';

type Props = {
  value: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
};

export default function AdherenceRing({
  value,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  color = 'rgb(198, 40, 40)',
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(1, Math.max(0, value));
  const offset = circumference * (1 - clampedValue);
  const pct = Math.round(clampedValue * 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: size, height: size }} className="relative">
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-kore-gray-light/30"
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black tracking-tight text-kore-gray-dark leading-none">
            {pct}%
          </span>
          {label && (
            <span className="text-[10px] font-semibold text-kore-gray-dark/50 uppercase tracking-wide mt-0.5">
              {label}
            </span>
          )}
        </div>
      </div>
      {sublabel && (
        <span className="text-xs text-kore-gray-dark/40 text-center">{sublabel}</span>
      )}
    </div>
  );
}
