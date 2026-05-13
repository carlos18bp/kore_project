type Props = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Field({ label, required, hint, error, children, className = '' }: Props) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-kore-burgundy/55">
          {label}
          {required && <span className="ml-1 text-kore-red">*</span>}
        </label>
        {hint && <span className="text-[10px] italic text-kore-burgundy/55">{hint}</span>}
      </div>
      {children}
      {error && <div className="mt-1.5 text-[11px] text-kore-red">{error}</div>}
    </div>
  );
}
