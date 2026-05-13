'use client';

interface Props {
  current: number;
  longest: number;
}

export default function StreakBadge({ current, longest }: Props) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
        <span className="text-[13px] leading-none">🔥</span>
        <div>
          <p className="font-heading text-[16px] font-bold text-amber-600 leading-none">{current}</p>
          <p className="text-[9px] text-amber-600/70 uppercase tracking-[0.1em] font-semibold mt-0.5">
            racha actual
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 bg-white/60 border border-white/60 rounded-lg px-2.5 py-1.5">
        <span className="text-[13px] leading-none">🏆</span>
        <div>
          <p className="font-heading text-[16px] font-bold text-kore-gray-dark leading-none">{longest}</p>
          <p className="text-[9px] text-kore-gray-dark/45 uppercase tracking-[0.1em] font-semibold mt-0.5">
            mejor racha
          </p>
        </div>
      </div>
    </div>
  );
}
