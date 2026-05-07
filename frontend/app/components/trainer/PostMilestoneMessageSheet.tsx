'use client';

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import SectionLabel from '@/app/components/shared/SectionLabel';
import { useTrainerStore } from '@/lib/stores/trainerStore';

type Props = {
  customerId: number;
  customerName: string;
  milestoneId?: number;
  milestoneLabel?: string;
  onClose: () => void;
};

const QUICK_SUGGESTIONS = [
  '¡Lograste un hito importante! Sigue así.',
  'Lo que has logrado esta semana es de admirar.',
  'Tu constancia se está reflejando. Vamos por más.',
];

export default function PostMilestoneMessageSheet({
  customerId,
  customerName,
  milestoneId,
  milestoneLabel,
  onClose,
}: Props) {
  const { sendTrainerMessage } = useTrainerStore();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await sendTrainerMessage(customerId, message.trim(), 'post_milestone', milestoneId);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-kore-gray-light rounded-full" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <div>
            <SectionLabel className="mb-1">Felicitar hito</SectionLabel>
            <p className="text-base font-semibold text-kore-gray-dark flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-600" />
              {customerName}
            </p>
            {milestoneLabel && (
              <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md inline-block mt-1">
                {milestoneLabel}
              </p>
            )}
            <p className="text-xs text-kore-gray-dark/50 mt-2 leading-relaxed">
              El cliente verá este mensaje con ícono de trofeo en su dashboard.
            </p>
          </div>

          <div>
            <SectionLabel className="mb-2">Sugerencias rápidas</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-kore-cream text-kore-gray-dark/70 hover:bg-kore-cream/70 active:scale-95 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Escribe tu mensaje..."
            className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        <div className="px-4 pt-2 pb-6 flex gap-3 border-t border-kore-gray-light/20">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-kore-cream text-kore-gray-dark/60 text-sm font-medium active:scale-95 transition-transform duration-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || sending}
            className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-medium active:scale-95 transition-transform duration-100 disabled:opacity-60 hover:bg-amber-600"
          >
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </>
  );
}
