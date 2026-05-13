'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useAuthStore } from '@/lib/stores/authStore';

export default function SubscriptionExpiryReminder() {
  const { expiryReminder, fetchExpiryReminder, acknowledgeExpiryReminder } = useSubscriptionStore();
  const { justLoggedIn, clearJustLoggedIn } = useAuthStore();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('kore_expiry_reminder_dismissed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (justLoggedIn) {
      fetchExpiryReminder();
    }
  }, [justLoggedIn, fetchExpiryReminder]);

  if (!justLoggedIn || !expiryReminder || dismissed) return null;

  const expiresAt = new Date(expiryReminder.expires_at);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const dateStr = expiresAt.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const handleDismiss = async () => {
    setDismissed(true);
    sessionStorage.setItem('kore_expiry_reminder_dismissed', 'true');
    await acknowledgeExpiryReminder(expiryReminder.id);
    clearJustLoggedIn();
  };

  const handleRenewClick = () => {
    acknowledgeExpiryReminder(expiryReminder.id);
    clearJustLoggedIn();
  };

  const packageId = expiryReminder.package?.id;
  const renewUrl = packageId ? `/checkout?package=${packageId}` : '/programs';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h3 className="font-heading text-lg font-semibold text-kore-gray-dark text-center mb-2">
          Tu suscripción está por vencer
        </h3>
        <p className="text-sm text-kore-gray-dark/60 text-center mb-1">
          Tu plan <span className="font-semibold text-kore-gray-dark">{expiryReminder.package?.title ?? 'KÓRE'}</span> vence el
        </p>
        <p className="text-sm font-semibold text-kore-gray-dark text-center capitalize mb-1">
          {dateStr}
        </p>
        <p className="text-sm text-kore-gray-dark/60 text-center mb-6">
          {daysLeft === 0
            ? 'Vence hoy. ¡Renueva para no perder tus sesiones!'
            : daysLeft === 1
              ? 'Queda 1 día. ¡Renueva para no perder tus sesiones!'
              : `Quedan ${daysLeft} días. ¡Renueva para no perder tus sesiones!`}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <Link
            href={renewUrl}
            onClick={handleRenewClick}
            className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-semibold text-center hover:bg-kore-red/90 transition-colors cursor-pointer"
          >
            Renovar ahora
          </Link>
        </div>
      </div>
    </div>
  );
}
