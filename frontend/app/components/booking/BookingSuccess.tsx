'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import type { BookingData } from '@/lib/stores/bookingStore';

type Props = {
  booking: BookingData;
  onReset: () => void;
};

export default function BookingSuccess({ booking, onReset }: Props) {
  const slotStart = new Date(booking.slot.starts_at);
  const slotEnd = new Date(booking.slot.ends_at);
  const trainerName = booking.trainer
    ? `${booking.trainer.first_name} ${booking.trainer.last_name}`
    : '—';

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onReset();
    },
    [onReset],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-xl relative max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onReset}
          className="absolute top-4 right-4 p-1 rounded-lg text-kore-gray-dark/40 hover:text-kore-gray-dark transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 text-center space-y-6">
          {/* Checkmark */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>

          <div>
            <h2 className="font-heading text-2xl font-semibold text-kore-gray-dark mb-2">
              Esta reunión está programada
            </h2>
            <p className="text-sm text-kore-gray-dark/50">
              Hemos enviado un correo electrónico con una invitación de calendario con los detalles.
            </p>
          </div>

          {/* Summary table */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-kore-gray-light/50 text-left divide-y divide-kore-gray-light/30">
            <div className="px-6 py-4 flex gap-4">
              <span className="text-sm text-kore-gray-dark/40 w-20 flex-shrink-0">Qué</span>
              <span className="text-sm font-medium text-kore-gray-dark">Entrenamiento Kóre</span>
            </div>
            <div className="px-6 py-4 flex gap-4">
              <span className="text-sm text-kore-gray-dark/40 w-20 flex-shrink-0">Cuándo</span>
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
              <span className="text-sm text-kore-gray-dark/40 w-20 flex-shrink-0">Quién</span>
              <span className="text-sm font-medium text-kore-gray-dark">{trainerName}</span>
            </div>
            {booking.trainer?.location && (
              <div className="px-6 py-4 flex gap-4">
                <span className="text-sm text-kore-gray-dark/40 w-20 flex-shrink-0">Dónde</span>
                <span className="text-sm font-medium text-kore-gray-dark">{booking.trainer.location}</span>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="space-y-3">
            <p className="text-sm text-kore-gray-dark/50">
              ¿Necesitas hacer un cambio? Visita{' '}
              <Link
                href={`/my-programs/program?id=${booking.subscription_id_display ?? ''}`}
                className="text-kore-red hover:underline font-medium"
              >
                tu programa
              </Link>
              {' '}para reprogramar o cancelar.
            </p>
            <button
              onClick={onReset}
              className="text-sm text-kore-gray-dark/40 hover:text-kore-gray-dark transition-colors cursor-pointer"
            >
              Agendar otra sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
