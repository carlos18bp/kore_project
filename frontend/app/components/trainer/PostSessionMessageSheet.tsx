'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import SectionLabel from '@/app/components/shared/SectionLabel';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import ResponsiveSheet from './ResponsiveSheet';

type Props = {
  customerId: number;
  customerName: string;
  sessionId: number;
  onClose: () => void;
};

const QUICK_SUGGESTIONS = [
  '¡Buen trabajo en la sesión de hoy!',
  'Recuerda hidratarte bien mañana.',
  'La próxima sesión trabajaremos un poco más fuerza.',
  'Excelente esfuerzo. Sigue así.',
];

export default function PostSessionMessageSheet({ customerId, customerName, sessionId, onClose }: Props) {
  const { sendTrainerMessage } = useTrainerStore();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await sendTrainerMessage(customerId, message.trim(), 'post_session', sessionId);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <ResponsiveSheet onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-4 xl:pt-5">
        <div>
          <SectionLabel className="mb-1">Mensaje post-sesión</SectionLabel>
          <p className="text-base font-semibold text-kore-gray-dark flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            {customerName}
          </p>
          <p className="text-xs text-kore-gray-dark/50 mt-1 leading-relaxed">
            El cliente verá este mensaje destacado en su dashboard, vinculado a esta sesión.
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
          className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>
      <div className="px-4 pt-2 pb-6 xl:pb-4 flex gap-3 border-t border-kore-gray-light/20">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-kore-cream text-kore-gray-dark/60 text-sm font-medium active:scale-95 transition-transform duration-100"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || sending}
          className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium active:scale-95 transition-transform duration-100 disabled:opacity-60"
        >
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </ResponsiveSheet>
  );
}
