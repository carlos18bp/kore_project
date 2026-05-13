'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { DayAdherence } from '@/lib/stores/progressStore';

// Single-letter day initial in Spanish, indexed by JS Date.getDay() (Sun=0).
const DAY_INITIAL: Record<string, string> = {
  '0': 'D', '1': 'L', '2': 'M', '3': 'X', '4': 'J', '5': 'V', '6': 'S',
};

const CHART_H = 60;
const BAR_W = 3;
const PAIR_GAP = 2;
const DAY_GAP = 10;

interface Props {
  days: DayAdherence[];
}

export default function WeeklyBarChart({ days }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !days.length) return;
    const bars = svgRef.current.querySelectorAll<SVGRectElement>('[data-bar]');
    gsap.fromTo(
      bars,
      { scaleY: 0, transformOrigin: 'bottom' },
      { scaleY: 1, transformOrigin: 'bottom', duration: 0.55, stagger: 0.04, ease: 'power2.out' },
    );
  }, [days]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const groupW = BAR_W * 2 + PAIR_GAP;
  const totalW = days.length * groupW + (days.length - 1) * DAY_GAP + 6;

  return (
    <div className="space-y-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalW} ${CHART_H + 14}`}
        className="w-full overflow-visible"
        preserveAspectRatio="xMidYMax meet"
      >
        {/* Baseline + half gridline (very subtle) */}
        <line x1="0" y1={CHART_H} x2={totalW} y2={CHART_H} stroke="currentColor" strokeWidth="0.4" className="text-kore-gray-dark/15" />
        <line x1="0" y1={CHART_H * 0.5} x2={totalW} y2={CHART_H * 0.5} stroke="currentColor" strokeWidth="0.4" strokeDasharray="1.5 3" className="text-kore-gray-dark/10" />

        {days.map((d, i) => {
          const x = 3 + i * (groupW + DAY_GAP);
          const isToday = d.date === todayStr;
          const dayOfWeek = String(new Date(d.date + 'T12:00:00').getDay());
          const label = DAY_INITIAL[dayOfWeek] ?? '';
          const trainH = Math.max(2, Math.round(d.training_adherence * CHART_H));
          const nutriH = Math.max(2, Math.round(d.nutrition_adherence * CHART_H));
          const isRest = d.day_type === 'rest';

          return (
            <g key={d.date}>
              {/* training bar */}
              <rect
                data-bar
                x={x}
                y={CHART_H - trainH}
                width={BAR_W}
                height={trainH}
                rx={1.5}
                className={isRest ? 'fill-kore-gray-dark/15' : 'fill-kore-red'}
                opacity={isRest ? 0.55 : 1}
              />
              {/* nutrition bar */}
              <rect
                data-bar
                x={x + BAR_W + PAIR_GAP}
                y={CHART_H - nutriH}
                width={BAR_W}
                height={nutriH}
                rx={1.5}
                className="fill-teal-400"
                opacity={0.9}
              />
              {/* day label */}
              <text
                x={x + groupW / 2}
                y={CHART_H + 11}
                textAnchor="middle"
                fontSize="9"
                fontWeight="500"
                className={isToday ? 'fill-kore-red font-semibold' : 'fill-kore-gray-dark/40'}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Compact legend */}
      <div className="flex items-center gap-3 px-0.5 text-[9px] text-kore-gray-dark/45 font-medium">
        <div className="flex items-center gap-1">
          <span className="w-[3px] h-2.5 rounded-sm bg-kore-red" />
          Entreno
        </div>
        <div className="flex items-center gap-1">
          <span className="w-[3px] h-2.5 rounded-sm bg-teal-400" />
          Nutrición
        </div>
      </div>
    </div>
  );
}
