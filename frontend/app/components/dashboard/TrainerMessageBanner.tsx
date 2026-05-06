'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';

type TrainerMsg = {
  id: number;
  message: string;
  created_at: string;
  trainer_name: string;
  seen_by_customer: boolean;
};

export default function TrainerMessageBanner() {
  const [messages, setMessages] = useState<TrainerMsg[]>([]);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;

    api.get('/my-trainer-messages/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        const msgs = res.data?.messages ?? [];
        setMessages(msgs.filter((m: TrainerMsg) => m.message));
      })
      .catch(() => {});
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="space-y-2">
      {messages.slice(0, 2).map((msg) => {
        const initials = msg.trainer_name
          .split(' ')
          .slice(0, 2)
          .map((w: string) => w[0])
          .join('')
          .toUpperCase() || 'E';
        const preview = msg.message.length > 120
          ? `${msg.message.slice(0, 120)}...`
          : msg.message;
        const date = new Date(msg.created_at).toLocaleDateString('es-CO', {
          day: '2-digit', month: 'short',
        });

        return (
          <div
            key={msg.id}
            className="bg-white rounded-[18px] border-l-4 border-l-kore-red border border-kore-gray-light/30 shadow-sm p-4 flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-kore-red">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-kore-gray-dark/40 mb-0.5">
                Mensaje de tu entrenador
              </p>
              <p className="text-sm text-kore-gray-dark leading-relaxed">{preview}</p>
              <p className="text-[10px] text-kore-gray-dark/30 mt-1">{date}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
