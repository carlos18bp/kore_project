'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/lib/stores/bookingStore';
import type { BookingData } from '@/lib/stores/bookingStore';

const BOOKING_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmada', className: 'bg-green-100 text-green-700' },
  canceled: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
};

const CANCEL_HOURS = 24;

type Props = {
  booking: BookingData;
  subscriptionId: number;
  onClose: () => void;
  onCanceled?: () => void;
};

export default function SessionDetailModal({ booking, subscriptionId, onClose, onCanceled }: Props) {
  const router = useRouter();
  const { loading, error, cancelBooking } = useBookingStore();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const slotStart = new Date(booking.slot.starts_at);
  const slotEnd = new Date(booking.slot.ends_at);
  const now = new Date();
  const hoursUntil = (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  const canModify = booking.status !== 'canceled' && hoursUntil >= CANCEL_HOURS;
  const isUpcoming = slotStart > now;

  const badge = BOOKING_STATUS_BADGE[booking.status] ?? BOOKING_STATUS_BADGE.pending;

  const trainerName = booking.trainer
    ? `${booking.trainer.first_name} ${booking.trainer.last_name}`
    : '—';

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleReschedule = useCallback(() => {
    const params = new URLSearchParams();
    params.set('reschedule', String(booking.id));
    params.set('subscription', String(subscriptionId));
    router.push(`/book-session?${params.toString()}`);
  }, [router, booking.id, subscriptionId]);

  const handleCancel = useCallback(async () => {
    const result = await cancelBooking(booking.id, cancelReason);
    if (result) {
      setShowCancelConfirm(false);
      onCanceled?.();
    }
  }, [booking.id, cancelReason, cancelBooking, onCanceled]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-xl relative max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-kore-gray-dark/40 hover:text-kore-gray-dark transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark">
              Detalle de Sesión
            </h2>
          </div>

          {/* Status badge */}
          <div className="flex items-center justify-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
            {!canModify && isUpcoming && booking.status !== 'canceled' && (
              <span className="text-xs text-amber-600">
                No se puede modificar a menos de {CANCEL_HOURS}h de la sesión
              </span>
            )}
          </div>

          {/* Details card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-kore-gray-light/50 text-left divide-y divide-kore-gray-light/30">
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
          {isUpcoming && booking.status !== 'canceled' && !showCancelConfirm && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleReschedule}
                disabled={!canModify || loading}
                title={!canModify ? `No se puede reprogramar a menos de ${CANCEL_HOURS}h` : ''}
                className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Reprogramar
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={!canModify || loading}
                title={!canModify ? `No se puede cancelar a menos de ${CANCEL_HOURS}h` : ''}
                className="flex-1 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Cancel confirmation inline */}
          {showCancelConfirm && (
            <div className="space-y-4">
              <h3 className="font-heading text-lg font-semibold text-kore-gray-dark">
                Cancelar sesión
              </h3>
              <p className="text-sm text-kore-gray-dark/50">
                ¿Estás seguro que deseas cancelar esta sesión? Esta acción no se puede deshacer.
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo de cancelación (opcional)"
                className="w-full px-4 py-3 rounded-xl border border-kore-gray-light/50 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 focus:outline-none focus:ring-2 focus:ring-kore-red/30 resize-none"
                rows={3}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors cursor-pointer"
                >
                  Volver
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Cancelando...' : 'Confirmar cancelación'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
