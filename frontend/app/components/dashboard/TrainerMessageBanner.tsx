'use client';

import { useEffect, useState } from 'react';
import { Trophy, Check, MessageCircle } from 'lucide-react';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';

type TriggerType = 'manual' | 'post_session' | 'post_milestone';

type TrainerMsg = {
  id: number;
  trigger_type: TriggerType;
  message: string;
  created_at: string;
  trainer_name: string;
  seen_by_customer: boolean;
};

const TRIGGER_STYLE: Record<TriggerType, {
  border: string;
  iconBg: string;
  iconColor: string;
  label: string;
  icon: typeof Trophy;
}> = {
  post_milestone: {
    border: 'border-l-amber-400',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    label: '🏆 Tu entrenador te felicita',
    icon: Trophy,
  },
  post_session: {
    border: 'border-l-emerald-400',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    label: 'Después de tu sesión',
    icon: Check,
  },
  manual: {
    border: 'border-l-kore-red',
    iconBg: 'bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10',
    iconColor: 'text-kore-red',
    label: 'Mensaje de tu entrenador',
    icon: MessageCircle,
  },
};

function authHeader() {
  const token = Cookies.get('accessToken') ?? Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function TrainerMessageBanner() {
  const [messages, setMessages] = useState<TrainerMsg[]>([]);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  useEffect(() => {
    const headers = authHeader();
    if (!('Authorization' in headers)) return;

    api.get('/my-trainer-messages/', { headers })
      .then((res) => {
        const msgs = (res.data?.messages ?? []) as TrainerMsg[];
        setMessages(msgs.filter((m) => m.message));
      })
      .catch(() => {});
  }, []);

  const handleDismiss = async (id: number) => {
    setDismissingId(id);
    try {
      await api.post(`/my-trainer-messages/${id}/dismiss/`, undefined, { headers: authHeader() });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // silent: keep the message visible if dismiss fails
    } finally {
      setDismissingId(null);
    }
  };

  if (messages.length === 0) return null;

  return (
    <div className="space-y-2">
      {messages.slice(0, 2).map((msg) => {
        const style = TRIGGER_STYLE[msg.trigger_type] ?? TRIGGER_STYLE.manual;
        const Icon = style.icon;
        const date = new Date(msg.created_at).toLocaleDateString('es-CO', {
          day: '2-digit', month: 'short',
        });
        const initials = msg.trainer_name
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0])
          .join('')
          .toUpperCase() || 'E';

        return (
          <div
            key={msg.id}
            className={`bg-white rounded-[18px] border-l-4 ${style.border} border border-kore-gray-light/30 shadow-sm p-4`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full ${style.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${style.iconColor}`} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/40 mb-0.5">
                  {style.label}
                </p>
                <p className="text-sm text-kore-gray-dark leading-relaxed">{msg.message}</p>
                <div className="flex items-center justify-between mt-2 gap-3">
                  <p className="text-[10px] text-kore-gray-dark/30">
                    {msg.trainer_name} · {date}
                  </p>
                  <button
                    onClick={() => handleDismiss(msg.id)}
                    disabled={dismissingId === msg.id}
                    className="text-[10px] font-semibold text-kore-red hover:text-kore-red-dark transition-colors disabled:opacity-50 active:scale-95"
                  >
                    {dismissingId === msg.id ? 'Marcando…' : 'Marcar como leído'}
                  </button>
                </div>
              </div>
              {/* Decorative initials */}
              <span className="text-[9px] font-bold text-kore-gray-dark/20 mt-0.5 flex-shrink-0">
                {initials}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
