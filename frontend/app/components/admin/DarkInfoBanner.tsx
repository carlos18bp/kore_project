type Props = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  chips?: string[];
};

export default function DarkInfoBanner({ icon, title, description, chips }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-kore-gold/15">
      <div className="absolute -top-10 right-0 w-44 h-44 rounded-full bg-kore-petal/15 blur-3xl pointer-events-none" />
      <div className="relative flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-kore-petal/15 border border-kore-petal/30 flex items-center justify-center font-heading text-lg text-kore-petal flex-shrink-0">
          {icon ?? '※'}
        </div>
        <div className="flex-1">
          <div className="font-heading text-[15px] font-semibold text-kore-ivory tracking-wide">
            {title}
          </div>
          <div className="text-xs text-kore-ivory/75 mt-2 leading-relaxed">{description}</div>
          {chips && chips.length > 0 && (
            <div className="flex gap-2.5 mt-3.5 flex-wrap">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="px-3 py-1.5 rounded-full bg-kore-gold/10 border border-kore-gold/22 text-[10px] font-medium text-kore-ivory/85 tracking-wide"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
