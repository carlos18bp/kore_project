'use client';

import { useEffect, useRef } from 'react';

type Props = {
  seconds: number;
  onComplete: () => void;
  onDismiss: () => void;
  remaining: number;
  setRemaining: (n: number | ((prev: number) => number)) => void;
};

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RestTimer({ seconds, onComplete, onDismiss, remaining, setRemaining }: Props) {
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          if (!doneRef.current) {
            doneRef.current = true;
            setTimeout(onComplete, 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const progress = remaining / seconds;
  const dash = CIRCUMFERENCE * progress;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeLabel = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <p className="text-xs font-semibold text-kore-gray-dark/50 uppercase tracking-wider">
        Descanso
      </p>
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44" cy="44" r={RADIUS}
            fill="none"
            stroke="#E5E5E5"
            strokeWidth="6"
          />
          <circle
            cx="44" cy="44" r={RADIUS}
            fill="none"
            stroke="#E00000"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE - dash}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-kore-gray-dark">
          {timeLabel}
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="text-sm font-semibold text-kore-red hover:text-kore-red/80 transition-colors px-4 py-1.5 rounded-xl border border-kore-red/30 hover:bg-kore-red/5"
      >
        Listo
      </button>
    </div>
  );
}
