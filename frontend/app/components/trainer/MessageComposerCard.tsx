'use client';

import { useState } from 'react';
import { Trophy, Check, MessageCircle } from 'lucide-react';
import SectionLabel from '@/app/components/shared/SectionLabel';

type TriggerType = 'manual' | 'post_session' | 'post_milestone';

const OPTIONS: { id: TriggerType; label: string; icon: typeof Trophy }[] = [
  { id: 'manual', label: 'Manual', icon: MessageCircle },
  { id: 'post_session', label: 'Post sesión', icon: Check },
  { id: 'post_milestone', label: 'Post hito', icon: Trophy },
];

type Props = {
  onSubmit: (message: string, triggerType: TriggerType) => Promise<void>;
};

export default function MessageComposerCard({ onSubmit }: Props) {
  const [message, setMessage] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('manual');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSubmit(message.trim(), triggerType);
      setMessage('');
      setTriggerType('manual');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4 space-y-3">
      <SectionLabel>Nuevo mensaje</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = triggerType === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setTriggerType(opt.id)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                active
                  ? 'bg-kore-gray-dark text-white'
                  : 'bg-kore-cream text-kore-gray-dark/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
              {opt.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Escribe un mensaje para este cliente..."
        className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 resize-none focus:outline-none focus:ring-2 focus:ring-kore-red/30"
      />
      <button
        onClick={handleSend}
        disabled={!message.trim() || sending}
        className="w-full py-2.5 rounded-xl bg-kore-red text-white text-sm font-medium active:scale-95 transition-transform duration-100 disabled:opacity-40"
      >
        {sending ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </div>
  );
}
