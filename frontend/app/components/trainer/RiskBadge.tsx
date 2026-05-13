import type { RiskLevel } from '@/lib/stores/trainerStore';

type Props = {
  level: RiskLevel;
  size?: 'sm' | 'md';
};

const CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  alto: {
    label: 'Alto riesgo',
    className: 'bg-kore-red/10 text-kore-red',
  },
  medio: {
    label: 'Riesgo medio',
    className: 'bg-amber-100 text-amber-700',
  },
  bajo: {
    label: 'Riesgo bajo',
    className: 'bg-green-100 text-green-700',
  },
  sin_riesgo: {
    label: 'Sin riesgo',
    className: 'bg-gray-100 text-gray-500',
  },
};

export default function RiskBadge({ level, size = 'md' }: Props) {
  const { label, className } = CONFIG[level] ?? CONFIG.sin_riesgo;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${className}`}>
      {label}
    </span>
  );
}
