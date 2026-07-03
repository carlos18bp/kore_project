'use client';

import { CalendarClock, ChevronRight } from 'lucide-react';

export default function NextSessionRow({ formattedDate, formattedTime, onShowUpcoming }: {
  formattedDate: string | null; formattedTime: string; onShowUpcoming: () => void;
}) {
  const dateLabel = formattedDate ?? 'Próximamente';
  return (
    <button
      type="button"
      onClick={onShowUpcoming}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm hover:bg-white/90 transition-colors active:scale-[0.99]"
    >
      <span className="w-8 h-8 rounded-full bg-kore-wine-dark/8 flex items-center justify-center flex-shrink-0">
        <CalendarClock className="w-4 h-4 text-kore-wine-dark/70" strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-kore-gray-dark/50">Próxima sesión</span>
        <span className="block text-[13px] font-semibold text-kore-gray-dark truncate">{dateLabel} · {formattedTime}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-kore-gray-dark/30 flex-shrink-0" strokeWidth={2} />
    </button>
  );
}
