type Tone = 'sakura' | 'sage' | 'amber' | 'wine' | 'gold';

const TONE_GRADIENTS: Record<Tone, string> = {
  sakura: 'from-kore-petal to-kore-gold',
  sage: 'from-kore-sage to-kore-sage-soft',
  amber: 'from-kore-gold to-kore-amber',
  wine: 'from-kore-crimson to-kore-wine',
  gold: 'from-kore-gold to-kore-petal',
};

type Props = {
  name: string;
  size?: number;
  tone?: Tone;
  className?: string;
};

export default function Avatar({ name, size = 36, tone = 'sakura', className = '' }: Props) {
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase() || '·';

  const fontSize = Math.round(size * 0.36);
  const isWine = tone === 'wine';

  return (
    <div
      className={`rounded-full bg-gradient-to-br flex items-center justify-center font-heading font-bold flex-shrink-0 ring-2 ring-white/35 ${TONE_GRADIENTS[tone]} ${
        isWine ? 'text-kore-ivory' : 'text-kore-wine-deep'
      } ${className}`}
      style={{ width: size, height: size, fontSize }}
    >
      {initials}
    </div>
  );
}
