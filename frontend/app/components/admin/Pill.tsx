type Tone = 'wine' | 'sage' | 'amber' | 'sakura' | 'neutral' | 'dark';
type Size = 'sm' | 'md';

const TONE_CLASSES: Record<Tone, { bg: string; fg: string; border: string }> = {
  wine: { bg: 'bg-kore-crimson/10', fg: 'text-kore-crimson', border: 'border-kore-crimson/25' },
  sage: { bg: 'bg-kore-sage/20', fg: 'text-kore-sage-deep', border: 'border-kore-sage/40' },
  amber: { bg: 'bg-kore-amber/22', fg: 'text-kore-amber-deep', border: 'border-kore-amber/40' },
  sakura: { bg: 'bg-kore-petal/22', fg: 'text-kore-crimson', border: 'border-kore-petal/45' },
  neutral: { bg: 'bg-kore-burgundy/6', fg: 'text-kore-burgundy/65', border: 'border-kore-burgundy/12' },
  dark: { bg: 'bg-kore-wine-deep/10', fg: 'text-kore-wine-deep', border: 'border-kore-wine-deep/20' },
};

type Props = {
  tone?: Tone;
  size?: Size;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
};

export default function Pill({ tone = 'wine', size = 'md', dot, children, className = '' }: Props) {
  const c = TONE_CLASSES[tone];
  const sizeClasses =
    size === 'sm'
      ? 'py-[3px] px-[9px] text-[9px] tracking-[0.18em]'
      : 'py-1 px-3 text-[10px] tracking-[0.16em]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase border ${c.bg} ${c.fg} ${c.border} ${sizeClasses} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full bg-current`} />}
      {children}
    </span>
  );
}
