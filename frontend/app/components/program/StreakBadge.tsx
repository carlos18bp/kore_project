'use client';

interface Props {
  current: number;
  longest: number;
}

export default function StreakBadge({ current, longest }: Props) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5">
        <span className="text-xl">🔥</span>
        <div>
          <p className="text-lg font-black text-amber-600 leading-none">{current}</p>
          <p className="text-[10px] text-amber-500 mt-0.5">racha actual</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 bg-white/60 border border-white/60 rounded-2xl px-4 py-2.5">
        <span className="text-xl">🏆</span>
        <div>
          <p className="text-lg font-black text-kore-gray-dark leading-none">{longest}</p>
          <p className="text-[10px] text-kore-gray-dark/40 mt-0.5">mejor racha</p>
        </div>
      </div>
    </div>
  );
}
