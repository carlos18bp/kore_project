'use client';

import { useId } from 'react';

type Props = {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  gradientFrom?: string;
  gradientTo?: string;
  /** rgba string for drop-shadow */
  glowColor?: string;
  trackColor?: string;
  /** Centered children (e.g. `<span>92%</span>`) */
  children?: React.ReactNode;
  className?: string;
};

export default function GlowRing({
  value,
  size = 96,
  stroke = 8,
  gradientFrom = '#FF4040',
  gradientTo = '#9A0526',
  glowColor = 'rgba(154,5,38,0.6)',
  trackColor = 'rgba(255,255,255,0.08)',
  children,
  className = '',
}: Props) {
  const gradId = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`gr-${gradId}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#gr-${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1000ms ease-out',
            filter: `drop-shadow(0 0 8px ${glowColor})`,
          }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}
