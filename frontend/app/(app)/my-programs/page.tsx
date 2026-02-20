'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import type { Subscription } from '@/lib/stores/bookingStore';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-green-100 text-green-700' },
  expired: { label: 'Vencido', className: 'bg-amber-100 text-amber-700' },
  canceled: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
};

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const badge = STATUS_BADGE[sub.status] ?? STATUS_BADGE.active;
  const expiresAt = new Date(sub.expires_at);

  return (
    <Link
      href={`/my-programs/program?id=${sub.id}`}
      className="block bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50 hover:border-kore-red/30 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="font-heading text-lg font-semibold text-kore-gray-dark">
          {sub.package.title}
        </h3>
        <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Sesiones</p>
          <p className="text-sm font-medium text-kore-gray-dark">
            {sub.sessions_used} / {sub.sessions_total}
            <span className="text-kore-gray-dark/40"> usadas</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Restantes</p>
          <p className="text-sm font-medium text-kore-red">{sub.sessions_remaining}</p>
        </div>
        <div>
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Vencimiento</p>
          <p className="text-sm font-medium text-kore-gray-dark">
            {expiresAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 bg-kore-gray-light/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-kore-red rounded-full transition-all duration-500"
          style={{ width: `${sub.sessions_total > 0 ? (sub.sessions_used / sub.sessions_total) * 100 : 0}%` }}
        />
      </div>
    </Link>
  );
}

export default function MySessionsPage() {
  const { user } = useAuthStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const { subscriptions, loading, fetchSubscriptions } = useBookingStore();

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-8 pb-16">
        {/* Header */}
        <div data-hero="badge" className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Mis Programas
          </h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        )}

        {/* Programs list */}
        {!loading && subscriptions.length > 0 && (
          <div data-hero="heading" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {subscriptions.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && subscriptions.length === 0 && (
          <div data-hero="heading" className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-kore-gray-light/40 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-semibold text-kore-gray-dark mb-2">
              No tienes programas aún
            </h3>
            <p className="text-sm text-kore-gray-dark/50 mb-6 max-w-sm">
              Adquiere un programa para comenzar a agendar tus sesiones de entrenamiento.
            </p>
            <Link
              href="/book-session"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-kore-red text-white text-sm font-semibold hover:bg-kore-red/90 transition-colors"
            >
              Agendar sesión
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
