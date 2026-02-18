'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useAuthStore } from '@/lib/stores/authStore';

export default function UpcomingSessionReminder() {
  const { upcomingReminder, fetchUpcomingReminder } = useBookingStore();
  const { justLoggedIn, clearJustLoggedIn } = useAuthStore();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('kore_reminder_dismissed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (justLoggedIn) {
      fetchUpcomingReminder();
    }
  }, [justLoggedIn, fetchUpcomingReminder]);

  if (!justLoggedIn || !upcomingReminder || dismissed) return null;

  const slotStart = new Date(upcomingReminder.slot.starts_at);
  const now = new Date();
  const hoursUntil = (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Only show if within 48 hours
  if (hoursUntil > 48 || hoursUntil < 0) return null;

  const dateStr = slotStart.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = slotStart.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const detailUrl = upcomingReminder.subscription_id_display
    ? `/my-programs/program/${upcomingReminder.subscription_id_display}`
    : `/my-programs`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-kore-red/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
        </div>

        <h3 className="font-heading text-lg font-semibold text-kore-gray-dark text-center mb-2">
          ¡Tienes una sesión próxima!
        </h3>
        <p className="text-sm text-kore-gray-dark/60 text-center mb-1">
          Tu sesión está programada para
        </p>
        <p className="text-sm font-semibold text-kore-gray-dark text-center capitalize mb-1">
          {dateStr}
        </p>
        <p className="text-sm text-kore-gray-dark/60 text-center mb-6">
          a las <span className="font-semibold text-kore-gray-dark">{timeStr}</span>. ¡No te olvides!
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setDismissed(true);
              sessionStorage.setItem('kore_reminder_dismissed', 'true');
              clearJustLoggedIn();
            }}
            className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <Link
            href={detailUrl}
            onClick={() => clearJustLoggedIn()}
            className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-semibold text-center hover:bg-kore-red/90 transition-colors"
          >
            Ver detalle
          </Link>
        </div>
      </div>
    </div>
  );
}
