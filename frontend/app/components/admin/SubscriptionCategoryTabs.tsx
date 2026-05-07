'use client';

type Category = 'semi_personalizado' | 'personalizado' | 'terapeutico';

type Tone = 'sakura' | 'amber' | 'sage';

type TabConfig = {
  k: Category;
  label: string;
  icon: string;
  tone: Tone;
};

const TABS: TabConfig[] = [
  { k: 'semi_personalizado', label: 'Pareja', icon: '♀♂', tone: 'sakura' },
  { k: 'personalizado', label: 'Personalizada', icon: '◐', tone: 'amber' },
  { k: 'terapeutico', label: 'Terapéutica', icon: '⚕', tone: 'sage' },
];

const PALETTE: Record<Tone, { gradient: string; glow: string }> = {
  sakura: { gradient: 'from-kore-petal to-kore-gold', glow: 'shadow-[0_8px_22px_-10px_rgba(244,199,199,0.7)]' },
  amber: { gradient: 'from-kore-gold to-kore-amber', glow: 'shadow-[0_8px_22px_-10px_rgba(229,201,122,0.7)]' },
  sage: { gradient: 'from-kore-sage to-kore-sage-soft', glow: 'shadow-[0_8px_22px_-10px_rgba(168,194,156,0.7)]' },
};

type Props = {
  active: Category;
  counts: Record<Category, number>;
  onChange: (cat: Category) => void;
};

export default function SubscriptionCategoryTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex gap-2.5 mb-5 flex-wrap">
      {TABS.map((tc) => {
        const sel = active === tc.k;
        const p = PALETTE[tc.tone];
        const containerCls = sel
          ? `bg-gradient-to-br ${p.gradient} border border-transparent ${p.glow} -translate-y-px`
          : 'bg-white/65 border border-kore-burgundy/8 hover:bg-white/90';
        return (
          <button
            key={tc.k}
            type="button"
            onClick={() => onChange(tc.k)}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-150 ${containerCls}`}
          >
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-heading text-sm ${
                sel ? 'bg-white/40 text-kore-wine-deep' : 'bg-kore-burgundy/6 text-kore-burgundy'
              }`}
            >
              {tc.icon}
            </span>
            <div className="text-left">
              <div
                className={`font-heading text-sm font-semibold leading-tight ${
                  sel ? 'text-kore-wine-deep' : 'text-kore-burgundy'
                }`}
              >
                {tc.label}
              </div>
              <div
                className={`text-[10px] font-semibold tracking-[0.10em] mt-0.5 ${
                  sel ? 'text-kore-wine-deep/70' : 'text-kore-burgundy/55'
                }`}
              >
                {counts[tc.k]} suscripcion{counts[tc.k] === 1 ? '' : 'es'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const SUBSCRIPTION_CATEGORIES = TABS;
