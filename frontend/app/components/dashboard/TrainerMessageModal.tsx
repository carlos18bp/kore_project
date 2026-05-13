'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { api } from '@/lib/services/http';
import Cookies from 'js-cookie';

type TriggerType = 'manual' | 'post_session' | 'post_milestone';

type TrainerMsg = {
  id: number;
  trigger_type: TriggerType;
  message: string;
  created_at: string;
  trainer_name: string;
};

const SESSION_KEY = 'kore_trainer_msg_shown';

const T = {
  wineDeep:  '#2D0F1A',
  wineDeep2: '#4A1828',
  wine:      '#5C2030',
  ivory:     '#FFF8EC',
  champagne: '#E7C8A0',
  sage:      '#A8C29C',
  amber:     '#E5C97A',
  petal:     '#F4C7C7',
};

const TRIGGER_CFG: Record<TriggerType, { label: string; dot: string; bg: string }> = {
  post_milestone: { label: 'Post hito',    dot: T.amber,     bg: 'rgba(229,201,122,0.12)' },
  post_session:   { label: 'Post sesión',  dot: T.sage,      bg: 'rgba(168,194,156,0.12)' },
  manual:         { label: 'Manual',       dot: T.champagne, bg: 'rgba(231,200,160,0.10)' },
};

function authHeader() {
  const token = Cookies.get('kore_token') ?? Cookies.get('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function TrainerMessageModal() {
  const { user, hydrated } = useAuthStore();
  const { profile, todayMood } = useProfileStore();

  const [messages, setMessages] = useState<TrainerMsg[]>([]);
  const [visible, setVisible] = useState(false);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  const fetchedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileFullyComplete =
    user?.profile_completed === true &&
    profile?.customer_profile?.profile_completed === true;

  const moodHandled =
    todayMood !== null ||
    (typeof window !== 'undefined' && sessionStorage.getItem('kore_mood_dismissed') !== null);

  useEffect(() => {
    if (!hydrated || !user) return;
    if (!profileFullyComplete || !moodHandled) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Delay so higher-priority modals (mood, session reminder) finish first
    timerRef.current = setTimeout(() => {
      const headers = authHeader();
      if (!('Authorization' in headers)) return;

      api
        .get('/my-trainer-messages/', { headers })
        .then((res) => {
          const msgs = (res.data?.messages ?? []) as TrainerMsg[];
          const valid = msgs.filter((m) => m.message);
          if (valid.length > 0) {
            setMessages(valid);
            setVisible(true);
          } else {
            // No messages — mark as checked so we don't retry this session
            sessionStorage.setItem(SESSION_KEY, '1');
          }
        })
        .catch(() => {});
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hydrated, user, profileFullyComplete, moodHandled]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, '1');
  }

  async function handleDismiss(id: number) {
    setDismissingId(id);
    try {
      await api.post(
        `/my-trainer-messages/${id}/dismiss/`,
        undefined,
        { headers: authHeader() },
      );
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== id);
        if (next.length === 0) {
          setVisible(false);
          sessionStorage.setItem(SESSION_KEY, '1');
        }
        return next;
      });
    } catch {
      /* keep message visible on failure */
    } finally {
      setDismissingId(null);
    }
  }

  if (!visible || messages.length === 0) return null;

  const trainerName = messages[0]?.trainer_name ?? 'Tu entrenador';
  const initials = trainerName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'E';

  return (
    <div
      className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(45,15,26,0.55)', backdropFilter: 'blur(8px)' }}
    >
      {/* Tap-outside closes */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div
        className="relative w-full sm:max-w-md mx-auto animate-in slide-in-from-bottom-4 fade-in duration-300"
        style={{
          borderRadius: '28px 28px 0 0',
          background: `linear-gradient(160deg, ${T.wineDeep} 0%, ${T.wineDeep2} 55%, ${T.wine} 100%)`,
          boxShadow: '0 -8px 48px -8px rgba(45,15,26,0.55)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        // Prevent tap-outside from firing when clicking inside the card
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(231,200,160,0.25)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '16px 24px 12px' }}>
          <div style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.26em', textTransform: 'uppercase',
            color: 'rgba(231,200,160,0.60)', marginBottom: 10,
          }}>
            Mensaje de tu entrenador
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: 20, flexShrink: 0,
              background: `linear-gradient(135deg, ${T.petal} 0%, ${T.champagne} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700,
                color: T.wineDeep,
              }}>
                {initials}
              </span>
            </div>

            <div>
              <div style={{
                fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.ivory,
              }}>
                {trainerName}
              </div>
              <div style={{
                fontFamily: 'Montserrat, sans-serif', fontSize: 10,
                color: 'rgba(231,200,160,0.55)',
              }}>
                {messages.length === 1 ? '1 mensaje nuevo' : `${messages.length} mensajes nuevos`}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(231,200,160,0.10)', margin: '0 24px' }} />

        {/* Messages — scrollable */}
        <div style={{
          overflowY: 'auto', padding: '14px 24px',
          display: 'flex', flexDirection: 'column', gap: 10,
          flex: 1,
        }}>
          {messages.map((msg) => {
            const cfg = TRIGGER_CFG[msg.trigger_type] ?? TRIGGER_CFG.manual;
            return (
              <div
                key={msg.id}
                style={{
                  background: cfg.bg,
                  borderRadius: 16, padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Trigger badge + date */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: 3,
                      background: cfg.dot, display: 'inline-block', flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.18em', textTransform: 'uppercase', color: cfg.dot,
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'Montserrat, sans-serif', fontSize: 10,
                    color: 'rgba(255,248,236,0.35)',
                  }}>
                    {formatDate(msg.created_at)}
                  </span>
                </div>

                {/* Message text */}
                <p style={{
                  fontFamily: 'Montserrat, sans-serif', fontSize: 13, lineHeight: 1.55,
                  color: T.ivory, margin: 0,
                }}>
                  {msg.message}
                </p>

                {/* Individual dismiss */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    onClick={() => handleDismiss(msg.id)}
                    disabled={dismissingId === msg.id}
                    style={{
                      fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 600,
                      color: 'rgba(231,200,160,0.50)', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '2px 0', transition: 'color 0.15s',
                    }}
                  >
                    {dismissingId === msg.id ? 'Marcando…' : 'Marcar como leído'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ padding: '12px 24px 28px' }}>
          <button
            onClick={handleClose}
            style={{
              width: '100%', padding: '14px 0',
              borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'rgba(231,200,160,0.16)',
              fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700,
              letterSpacing: '0.10em', color: T.champagne,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = 'rgba(231,200,160,0.24)'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = 'rgba(231,200,160,0.16)'; }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
