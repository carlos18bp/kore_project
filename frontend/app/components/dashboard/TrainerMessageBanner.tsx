'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Check, MessageCircle, X } from 'lucide-react';
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
  accent: string;
  iconBg: string;
  iconColor: string;
  label: string;
  icon: typeof Trophy;
}> = {
  post_milestone: {
    accent: '#D97706',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    label: '🏆 Tu entrenador te felicita',
    icon: Trophy,
  },
  post_session: {
    accent: '#059669',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    label: 'Después de tu sesión',
    icon: Check,
  },
  manual: {
    accent: '#9A0526',
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

/**
 * Mensajes del entrenador en el dashboard del cliente. Se presentan como una
 * mini-card que se despliega desde abajo (anclada sobre la bottom-nav) y
 * persiste hasta que el cliente la marca como leída o la cierra.
 */
export default function TrainerMessageBanner() {
  const [messages, setMessages] = useState<TrainerMsg[]>([]);
  const [dismissing, setDismissing] = useState(false);
  const [closed, setClosed] = useState(false);

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

  // Se muestra un mensaje a la vez; al marcar como leído se revela el siguiente.
  const current = messages[0] ?? null;
  const remaining = messages.length - 1;

  const handleDismiss = async () => {
    if (!current || dismissing) return;
    setDismissing(true);
    try {
      await api.post(`/my-trainer-messages/${current.id}/dismiss/`, undefined, { headers: authHeader() });
      setMessages((prev) => prev.filter((m) => m.id !== current.id));
    } catch {
      // silent: keep the message visible if dismiss fails
    } finally {
      setDismissing(false);
    }
  };

  const visible = !!current && !closed;
  const style = current ? (TRIGGER_STYLE[current.trigger_type] ?? TRIGGER_STYLE.manual) : TRIGGER_STYLE.manual;
  const Icon = style.icon;
  const date = current
    ? new Date(current.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    : '';

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          key="trainer-msg-dock"
          initial={{ y: '130%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '130%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed left-3 right-3 z-40 bottom-[calc(80px_+_env(safe-area-inset-bottom))] xl:left-auto xl:right-6 xl:bottom-6 xl:w-[360px]"
        >
          <div className="overflow-hidden rounded-[20px] border border-kore-gray-light/40 bg-white shadow-[0_14px_44px_-12px_rgba(45,15,26,0.45)]">
            <div style={{ height: 3, background: style.accent }} />
            <div className="p-4">
              {/* Header: ícono + label + contador + cerrar */}
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${style.iconBg}`}>
                  <Icon className={`h-4 w-4 ${style.iconColor}`} strokeWidth={2.5} />
                </div>
                <p className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-kore-gray-dark/45">
                  {style.label}
                </p>
                {remaining > 0 && (
                  <span
                    className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-kore-gray-dark/55"
                    style={{ background: 'rgba(103,15,34,0.07)' }}
                  >
                    +{remaining}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setClosed(true)}
                  aria-label="Cerrar"
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-kore-gray-dark/40 transition hover:bg-kore-gray-light/30 active:scale-90"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Mensaje */}
              <p className="mt-2.5 max-h-[38vh] overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-relaxed text-kore-gray-dark">
                {current.message}
              </p>

              {/* Footer: autor + acción */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[10.5px] text-kore-gray-dark/40">
                  {current.trainer_name} · {date}
                </p>
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={dismissing}
                  className="flex-shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-white transition active:scale-95 disabled:opacity-50"
                  style={{ background: style.accent }}
                >
                  {dismissing ? 'Marcando…' : 'Marcar como leído'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
