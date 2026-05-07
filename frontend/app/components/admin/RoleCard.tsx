'use client';

type Tone = 'sakura' | 'sage';

type Props = {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon: string;
  tone: Tone;
};

const TONES: Record<Tone, { glow: string; accent: string; iconBg: string; accentRing: string }> = {
  sakura: {
    glow: 'from-kore-petal to-kore-ivory',
    accent: 'border-kore-red',
    iconBg: 'text-kore-red',
    accentRing: 'border-kore-red',
  },
  sage: {
    glow: 'from-kore-sage to-kore-ivory',
    accent: 'border-kore-sage-deep',
    iconBg: 'text-kore-sage-deep',
    accentRing: 'border-kore-sage-deep',
  },
};

export default function RoleCard({ selected, onSelect, title, description, icon, tone }: Props) {
  const c = TONES[tone];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative text-left p-4 rounded-2xl transition-all duration-150 ${
        selected
          ? `bg-white border-2 ${c.accent} shadow-[0_6px_20px_-10px_rgba(45,15,26,0.25)]`
          : 'bg-white/55 border border-kore-burgundy/10 hover:bg-white/80'
      }`}
    >
      <div className="flex items-center gap-3 mb-1.5">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center font-heading text-base ${c.iconBg} ${
            selected ? `bg-gradient-to-br ${c.glow}` : 'bg-kore-burgundy/4 border border-kore-burgundy/8'
          }`}
        >
          {icon}
        </div>
        <div
          className={`font-heading text-[15px] font-semibold ${
            selected ? 'text-kore-burgundy' : 'text-kore-gray-dark'
          }`}
        >
          {title}
        </div>
        <div className="flex-1" />
        <div
          className={`w-[18px] h-[18px] rounded-full bg-white transition-all ${
            selected ? `border-[5px] ${c.accentRing}` : 'border-[1.5px] border-kore-burgundy/15'
          }`}
        />
      </div>
      <div className="text-[11px] text-kore-burgundy/65 leading-relaxed">{description}</div>
    </button>
  );
}
