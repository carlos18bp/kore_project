'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { DayAdherence } from '@/lib/stores/progressStore';

const DAY_SHORT: Record<string, string> = {
  '0': 'Dom', '1': 'Lun', '2': 'Mar', '3': 'Mié', '4': 'Jue', '5': 'Vie', '6': 'Sáb',
};

const CHART_H = 120;
const BAR_W = 20;
const GAP = 10;

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
      { scaleY: 1, transformOrigin: 'bottom', duration: 0.6, stagger: 0.07, ease: 'back.out(1.2)' },
    );
  }, [days]);

  const totalW = days.length * (BAR_W * 2 + GAP) + GAP;

  return (
    <div className="space-y-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalW} ${CHART_H + 24}`}
        className="w-full overflow-visible"
      >
        {days.map((d, i) => {
          const x = GAP + i * (BAR_W * 2 + GAP);
          const trainH = Math.max(2, Math.round(d.training_adherence * CHART_H));
          const nutriH = Math.max(2, Math.round(d.nutrition_adherence * CHART_H));
          const dayOfWeek = String(new Date(d.date + 'T12:00:00').getDay());
          const label = DAY_SHORT[dayOfWeek] ?? '–';
          const isToday = d.date === new Date().toISOString().slice(0, 10);

          return (
            <g key={d.date}>
              {/* training bar */}
              <rect
                data-bar
                x={x}
                y={CHART_H - trainH}
                width={BAR_W}
                height={trainH}
                rx={4}
                className={d.day_type === 'rest' ? 'fill-gray-200' : 'fill-kore-red'}
                opacity={d.day_type === 'rest' ? 0.5 : 1}
              />
              {/* nutrition bar */}
              <rect
                data-bar
                x={x + BAR_W + 2}
                y={CHART_H - nutriH}
                width={BAR_W - 2}
                height={nutriH}
                rx={4}
                className="fill-teal-400"
                opacity={0.8}
              />
              {/* day label */}
              <text
                x={x + BAR_W}
                y={CHART_H + 16}
                textAnchor="middle"
                fontSize={9}
                className={`fill-current ${isToday ? 'font-bold fill-kore-red' : 'fill-kore-gray-dark/40'}`}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-kore-red inline-block" />
          <span className="text-[10px] text-kore-gray-dark/50">Entrenamiento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-teal-400 inline-block" />
          <span className="text-[10px] text-kore-gray-dark/50">Nutrición</span>
        </div>
      </div>
    </div>
  );
}
