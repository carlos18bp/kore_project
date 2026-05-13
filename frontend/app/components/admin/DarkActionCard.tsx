'use client';

type Props = {
  title: string;
  description: string;
  cta: string;
  icon?: React.ReactNode;
  onAction: () => void;
  disabled?: boolean;
};

export default function DarkActionCard({ title, description, cta, icon, onAction, disabled }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-kore-gold/15 shadow-lg flex items-center gap-4">
      <div className="absolute -top-8 right-0 w-32 h-32 rounded-full bg-kore-petal/15 blur-3xl pointer-events-none" />
      <div className="relative w-[46px] h-[46px] rounded-xl flex-shrink-0 bg-kore-petal/15 border border-kore-petal/30 flex items-center justify-center font-heading text-lg text-kore-petal">
        {icon ?? '✉'}
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="font-heading text-sm font-semibold text-kore-ivory">{title}</div>
        <div className="text-[11px] text-kore-ivory/70 mt-1 leading-relaxed">{description}</div>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="relative px-4 py-2.5 rounded-xl bg-kore-petal/15 border border-kore-petal/35 text-kore-ivory text-[11px] font-semibold tracking-[0.04em] hover:bg-kore-petal/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
      >
        {cta}
      </button>
    </div>
  );
}
