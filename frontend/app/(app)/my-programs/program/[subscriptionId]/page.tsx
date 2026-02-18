'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import SessionDetailModal from '@/app/components/booking/SessionDetailModal';
import type { BookingData } from '@/lib/stores/bookingStore';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-green-100 text-green-700' },
  expired: { label: 'Vencido', className: 'bg-amber-100 text-amber-700' },
  canceled: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
};

const BOOKING_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmada', className: 'bg-green-100 text-green-700' },
  canceled: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
};

function BookingRow({ booking, onClick }: { booking: BookingData; onClick: () => void }) {
  const badge = BOOKING_STATUS_BADGE[booking.status] ?? BOOKING_STATUS_BADGE.pending;
  const slotStart = new Date(booking.slot.starts_at);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 px-4 py-4 rounded-xl hover:bg-kore-cream/60 transition-colors text-left cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-kore-gray-dark capitalize">
          {slotStart.toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <p className="text-xs text-kore-gray-dark/50 mt-0.5">
          {slotStart.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          {' — '}
          {new Date(booking.slot.ends_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          {booking.trainer && (
            <span> · {booking.trainer.first_name} {booking.trainer.last_name}</span>
          )}
        </p>
      </div>
      <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
        {badge.label}
      </span>
    </button>
  );
}

export default function ProgramDetailPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const subscriptionId = params.subscriptionId as string;
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const {
    subscriptions,
    bookings,
    bookingsPagination,
    loading,
    fetchSubscriptions,
    fetchBookings,
  } = useBookingStore();

  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);

  const handleSessionCanceled = useCallback(() => {
    setSelectedBooking(null);
    if (subscriptionId) {
      fetchBookings(Number(subscriptionId), page);
    }
  }, [subscriptionId, page, fetchBookings]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    if (subscriptionId) {
      fetchBookings(Number(subscriptionId), page);
    }
  }, [subscriptionId, page, fetchBookings]);

  const subscription = useMemo(
    () => subscriptions.find((s) => s.id === Number(subscriptionId)) ?? null,
    [subscriptions, subscriptionId],
  );

  const now = new Date();
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const slotStart = new Date(b.slot.starts_at);
      if (tab === 'upcoming') return slotStart >= now && b.status !== 'canceled';
      return slotStart < now || b.status === 'canceled';
    });
  }, [bookings, tab]);

  const totalPages = Math.ceil(bookingsPagination.count / 10);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  const subBadge = subscription ? (STATUS_BADGE[subscription.status] ?? STATUS_BADGE.active) : null;

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-8 pb-16">
        {/* Breadcrumb */}
        <div data-hero="badge" className="mb-8">
          <div className="flex items-center gap-2 text-xs text-kore-gray-dark/40 mb-2">
            <Link href="/my-programs" className="hover:text-kore-red transition-colors">
              Mis Programas
            </Link>
            <span>/</span>
            <span className="text-kore-gray-dark/60">Programa</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            {subscription?.package.title ?? 'Programa'}
          </h1>
        </div>

        {/* Program header card */}
        {subscription && (
          <div data-hero="heading" className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50 mb-8">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">
                  {subscription.package.title}
                </h2>
              </div>
              {subBadge && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${subBadge.className}`}>
                  {subBadge.label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Restantes</p>
                <p className="text-lg font-semibold text-kore-red">{subscription.sessions_remaining}</p>
              </div>
              <div>
                <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Total</p>
                <p className="text-lg font-semibold text-kore-gray-dark">{subscription.sessions_total}</p>
              </div>
              <div>
                <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Vencimiento</p>
                <p className="text-sm font-medium text-kore-gray-dark">
                  {new Date(subscription.expires_at).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Usadas</p>
                <p className="text-lg font-semibold text-kore-gray-dark">{subscription.sessions_used}</p>
              </div>
            </div>
            <div className="mt-4 h-2 bg-kore-gray-light/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-kore-red rounded-full transition-all duration-500"
                style={{
                  width: `${subscription.sessions_total > 0
                    ? (subscription.sessions_used / subscription.sessions_total) * 100
                    : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div data-hero="body" className="mb-6">
          <div className="flex gap-1 bg-kore-gray-light/30 rounded-xl p-1 w-fit">
            {(['upcoming', 'past'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-white text-kore-gray-dark shadow-sm'
                    : 'text-kore-gray-dark/50 hover:text-kore-gray-dark'
                }`}
              >
                {t === 'upcoming' ? 'Próximas' : 'Pasadas'}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions list */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-kore-gray-light/50 divide-y divide-kore-gray-light/30">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && filteredBookings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-kore-gray-dark/40">
                {tab === 'upcoming'
                  ? 'No tienes sesiones próximas.'
                  : 'No hay sesiones pasadas.'}
              </p>
              {tab === 'upcoming' && (
                <Link
                  href={`/book-session?subscription=${subscriptionId}`}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-kore-red text-white text-sm font-semibold hover:bg-kore-red/90 transition-colors cursor-pointer"
                >
                  Agendar sesión
                </Link>
              )}
            </div>
          )}

          {!loading && filteredBookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} onClick={() => setSelectedBooking(booking)} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-kore-gray-light/50 text-kore-gray-dark/60 hover:bg-kore-cream transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-kore-gray-dark/50">
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-kore-gray-light/50 text-kore-gray-dark/60 hover:bg-kore-cream transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Session detail modal */}
      {selectedBooking && (
        <SessionDetailModal
          booking={selectedBooking}
          subscriptionId={Number(subscriptionId)}
          onClose={() => setSelectedBooking(null)}
          onCanceled={handleSessionCanceled}
        />
      )}
    </section>
  );
}
