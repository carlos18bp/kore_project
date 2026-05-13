type Props = {
  kicker?: string;
  title: string;
  hint?: string;
  right?: React.ReactNode;
  className?: string;
};

export default function SectionLabel({ kicker, title, hint, right, className = '' }: Props) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div>
        {kicker && (
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            {kicker}
          </div>
        )}
        <div className={`font-heading text-lg font-semibold text-kore-burgundy ${kicker ? 'mt-1' : ''}`}>
          {title}
        </div>
        {hint && <div className="text-xs text-kore-burgundy/60 mt-1">{hint}</div>}
      </div>
      {right}
    </div>
  );
}
