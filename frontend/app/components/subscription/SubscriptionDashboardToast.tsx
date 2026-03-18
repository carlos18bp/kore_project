'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

type ToastType = 'expiry' | 'billing_failed' | null;

export default function SubscriptionDashboardToast() {
  const { activeSubscription: sub, fetchSubscriptions } = useSubscriptionStore();
  const [dismissed, setDismissed] = useState<ToastType>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissedValue = sessionStorage.getItem('kore_dashboard_toast_dismissed');
      if (dismissedValue === 'expiry' || dismissedValue === 'billing_failed') {
        setDismissed(dismissedValue as ToastType);
      }
    }
  }, []);

  if (!mounted || !sub || sub.status !== 'active') return null;

  const handleDismiss = (type: ToastType) => {
    setDismissed(type);
    if (typeof window !== 'undefined' && type) {
      sessionStorage.setItem('kore_dashboard_toast_dismissed', type);
    }
  };

  // Check for billing failure (recurring subscription with failed charge)
  if (sub.billing_failed_at && dismissed !== 'billing_failed') {
    const packageId = sub.package?.id;
    const renewUrl = packageId ? `/checkout?package=${packageId}` : '/programs';

    return (
      <div className="fixed bottom-4 right-4 z-40 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-white rounded-xl shadow-lg border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <AlertIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-kore-gray-dark">
                No pudimos procesar tu pago
              </p>
              <p className="text-xs text-kore-gray-dark/60 mt-0.5">
                Actualiza tu método de pago para mantener tu suscripción activa.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Link
                  href={renewUrl}
                  className="text-xs font-medium text-white bg-kore-red px-3 py-1.5 rounded-lg hover:bg-kore-red/90 transition-colors"
                >
                  Actualizar pago
                </Link>
                <button
                  onClick={() => handleDismiss('billing_failed')}
                  className="text-xs text-kore-gray-dark/50 hover:text-kore-gray-dark transition-colors"
                >
                  Más tarde
                </button>
              </div>
            </div>
            <button
              onClick={() => handleDismiss('billing_failed')}
              className="flex-shrink-0 text-kore-gray-dark/30 hover:text-kore-gray-dark/60 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check for expiring subscription (non-recurring, expires within 7 days)
  if (!sub.is_recurring && dismissed !== 'expiry') {
    const expiresAt = new Date(sub.expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 7 && daysLeft >= 0) {
      const packageId = sub.package?.id;
      const renewUrl = packageId ? `/checkout?package=${packageId}` : '/programs';
      const daysText = daysLeft === 0 ? 'Vence hoy' : daysLeft === 1 ? 'Vence mañana' : `Vence en ${daysLeft} días`;

      return (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-white rounded-xl shadow-lg border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <ClockIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-kore-gray-dark">
                  Tu suscripción {daysText.toLowerCase()}
                </p>
                <p className="text-xs text-kore-gray-dark/60 mt-0.5">
                  Renueva para conservar hasta 2 sesiones.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Link
                    href={renewUrl}
                    className="text-xs font-medium text-white bg-kore-red px-3 py-1.5 rounded-lg hover:bg-kore-red/90 transition-colors"
                  >
                    Renovar ahora
                  </Link>
                  <button
                    onClick={() => handleDismiss('expiry')}
                    className="text-xs text-kore-gray-dark/50 hover:text-kore-gray-dark transition-colors"
                  >
                    Más tarde
                  </button>
                </div>
              </div>
              <button
                onClick={() => handleDismiss('expiry')}
                className="flex-shrink-0 text-kore-gray-dark/30 hover:text-kore-gray-dark/60 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return null;
}
