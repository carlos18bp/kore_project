'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

const BOOKING_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmada', className: 'bg-green-100 text-green-700' },
  canceled: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
};

const CANCEL_HOURS = 24;

export default function SessionDetailPage() {
  const { user } = useAuthStore();
  const params = useParams();
  const router = useRouter();
  const subscriptionId = params.subscriptionId as string;
  const bookingId = params.bookingId as string;
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const {
    bookings,
    loading,
    error,
    fetchBookings,
    cancelBooking,
  } = useBookingStore();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (subscriptionId) {
      fetchBookings(Number(subscriptionId));
    }
  }, [subscriptionId, fetchBookings]);

  const booking = useMemo(
    () => bookings.find((b) => b.id === Number(bookingId)) ?? null,
    [bookings, bookingId],
  );

  const slotStart = booking ? new Date(booking.slot.starts_at) : null;
  const slotEnd = booking ? new Date(booking.slot.ends_at) : null;
  const now = new Date();
  const hoursUntil = slotStart ? (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60) : 0;
  const canModify = booking?.status !== 'canceled' && hoursUntil >= CANCEL_HOURS;
  const isUpcoming = slotStart ? slotStart > now : false;

  const badge = booking ? (BOOKING_STATUS_BADGE[booking.status] ?? BOOKING_STATUS_BADGE.pending) : null;

  const trainerName = booking?.trainer
    ? `${booking.trainer.first_name} ${booking.trainer.last_name}`
    : '—';

  const handleCancel = useCallback(async () => {
    if (!booking) return;
    const result = await cancelBooking(booking.id, cancelReason);
    if (result) {
      setShowCancelModal(false);
      fetchBookings(Number(subscriptionId));
    }
  }, [booking, cancelReason, cancelBooking, subscriptionId, fetchBookings]);

  const handleReschedule = useCallback(() => {
    router.push('/book-session');
  }, [router]);

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
        {/* Breadcrumb */}
        <div data-hero="badge" className="mb-8">
          <div className="flex items-center gap-2 text-xs text-kore-gray-dark/40 mb-2">
            <Link href="/my-sessions" className="hover:text-kore-red transition-colors">
              Mis Sesiones
            </Link>
            <span>/</span>
            <Link
              href={`/my-sessions/program/${subscriptionId}`}
              className="hover:text-kore-red transition-colors"
            >
              Programa
            </Link>
            <span>/</span>
            <span className="text-kore-gray-dark/60">Sesión</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Detalle de Sesión
          </h1>
        </div>

        {/* Loading */}
        {loading && !booking && (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        )}

        {/* Not found */}
        {!loading && !booking && (
          <div className="text-center py-16">
            <p className="text-sm text-kore-gray-dark/50">Sesión no encontrada.</p>
            <Link
              href={`/my-sessions/program/${subscriptionId}`}
              className="mt-4 inline-block text-sm text-kore-red hover:underline"
            >
              Volver al programa
            </Link>
          </div>
        )}

        {/* Session detail */}
        {booking && slotStart && slotEnd && (
          <div data-hero="heading" className="max-w-2xl mx-auto space-y-6">
            {/* Status badge */}
            <div className="flex items-center gap-3">
              {badge && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              )}
              {!canModify && isUpcoming && booking.status !== 'canceled' && (
                <span className="text-xs text-amber-600">
                  No se puede modificar a menos de {CANCEL_HOURS}h de la sesión
                </span>
              )}
            </div>

            {/* Details card */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-kore-gray-light/50 divide-y divide-kore-gray-light/30">
              <div className="px-6 py-4 flex gap-4">
                <span className="text-sm text-kore-gray-dark/40 w-24 flex-shrink-0">Qué</span>
                <span className="text-sm font-medium text-kore-gray-dark">Entrenamiento Kóre</span>
              </div>
              <div className="px-6 py-4 flex gap-4">
                <span className="text-sm text-kore-gray-dark/40 w-24 flex-shrink-0">Cuándo</span>
                <span className="text-sm font-medium text-kore-gray-dark capitalize">
                  {slotStart.toLocaleDateString('es-CO', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {' — '}
                  {slotStart.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  {' a '}
                  {slotEnd.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="px-6 py-4 flex gap-4">
                <span className="text-sm text-kore-gray-dark/40 w-24 flex-shrink-0">Entrenador</span>
                <span className="text-sm font-medium text-kore-gray-dark">{trainerName}</span>
              </div>
              {booking.trainer?.location && (
                <div className="px-6 py-4 flex gap-4">
                  <span className="text-sm text-kore-gray-dark/40 w-24 flex-shrink-0">Dónde</span>
                  <span className="text-sm font-medium text-kore-gray-dark">{booking.trainer.location}</span>
                </div>
              )}
              {booking.package && (
                <div className="px-6 py-4 flex gap-4">
                  <span className="text-sm text-kore-gray-dark/40 w-24 flex-shrink-0">Programa</span>
                  <span className="text-sm font-medium text-kore-gray-dark">{booking.package.title}</span>
                </div>
              )}
              {booking.canceled_reason && (
                <div className="px-6 py-4 flex gap-4">
                  <span className="text-sm text-kore-gray-dark/40 w-24 flex-shrink-0">Motivo</span>
                  <span className="text-sm text-red-600">{booking.canceled_reason}</span>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Actions */}
            {isUpcoming && booking.status !== 'canceled' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReschedule}
                  disabled={!canModify || loading}
                  title={!canModify ? `No se puede reprogramar a menos de ${CANCEL_HOURS}h` : ''}
                  className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Reprogramar
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={!canModify || loading}
                  title={!canModify ? `No se puede cancelar a menos de ${CANCEL_HOURS}h` : ''}
                  className="flex-1 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="font-heading text-lg font-semibold text-kore-gray-dark mb-2">
              Cancelar sesión
            </h3>
            <p className="text-sm text-kore-gray-dark/50 mb-4">
              ¿Estás seguro que deseas cancelar esta sesión? Esta acción no se puede deshacer.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo de cancelación (opcional)"
              className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 focus:outline-none focus:ring-2 focus:ring-kore-red/30 resize-none"
              rows={3}
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
