'use client';

type Props = {
  slots: string[];
  selectedStartsAt: string | null;
  onSelect: (startsAt: string) => void;
};

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function TimeSlotPicker({ slots, selectedStartsAt, onSelect }: Props) {
  if (slots.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-kore-gray-dark/40">
        No hay horarios disponibles para este día.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      {slots.map((startsAt) => {
        const isSelected = selectedStartsAt === startsAt;
        return (
          <button
            key={startsAt}
            onClick={() => onSelect(startsAt)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
              isSelected
                ? 'border-kore-red bg-kore-red/10 text-kore-red'
                : 'border-kore-gray-light/50 text-kore-gray-dark hover:border-kore-red/40 hover:bg-kore-red/5'
            }`}
          >
            {formatTime(startsAt)}
          </button>
        );
      })}
    </div>
  );
}
