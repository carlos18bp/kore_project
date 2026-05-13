'use client';

type Tone = 'amber' | 'danger';

type Props = {
  tone: Tone;
  title: string;
  description: string;
  cta: string;
  onAction: () => void;
  disabled?: boolean;
};

const TONE_CLASSES: Record<Tone, { bg: string; border: string; fg: string }> = {
  amber: {
    bg: 'bg-kore-amber/10',
    border: 'border-kore-amber/30',
    fg: 'text-kore-amber-deep',
  },
  danger: {
    bg: 'bg-kore-red/6',
    border: 'border-kore-red/20',
    fg: 'text-kore-red',
  },
};

export default function SoftActionCard({ tone, title, description, cta, onAction, disabled }: Props) {
  const c = TONE_CLASSES[tone];
  return (
    <div className={`rounded-2xl p-5 border flex flex-col justify-between gap-3 ${c.bg} ${c.border}`}>
      <div>
        <div className={`font-heading text-sm font-semibold ${c.fg}`}>{title}</div>
        <div className="text-[11px] text-kore-burgundy/65 mt-1 leading-relaxed">{description}</div>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className={`self-start px-3.5 py-2 rounded-lg bg-transparent border ${c.border.replace('/30', '/45').replace('/20', '/40')} ${c.fg} text-[11px] font-semibold tracking-[0.04em] hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
      >
        {cta}
      </button>
    </div>
  );
}
