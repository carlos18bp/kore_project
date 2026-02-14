'use client';

import type { Trainer, Slot, Subscription } from '@/lib/stores/bookingStore';
import { useAuthStore } from '@/lib/stores/authStore';
import TrainerInfoPanel from './TrainerInfoPanel';

type Props = {
  trainer: Trainer | null;
  slot: Slot;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
};

export default function BookingConfirmation({
  trainer,
  slot,
  subscription,
  loading,
  error,
  onConfirm,
  onBack,
}: Props) {
  const { user } = useAuthStore();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left — Trainer + slot info */}
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
        <TrainerInfoPanel trainer={trainer} selectedSlot={slot} />
      </div>

      {/* Right — User info + confirm */}
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50 space-y-6">
        <h3 className="font-heading text-lg font-semibold text-kore-gray-dark">
          Confirmar reserva
        </h3>

        {/* User data (read-only) */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-kore-gray-dark/40 uppercase tracking-widest">Nombre</label>
            <p className="text-sm font-medium text-kore-gray-dark mt-1">
              {user?.name ?? '—'}
            </p>
          </div>
          <div>
            <label className="text-xs text-kore-gray-dark/40 uppercase tracking-widest">Email</label>
            <p className="text-sm font-medium text-kore-gray-dark mt-1">
              {user?.email ?? '—'}
            </p>
          </div>
          {subscription && (
            <div>
              <label className="text-xs text-kore-gray-dark/40 uppercase tracking-widest">Programa</label>
              <p className="text-sm font-medium text-kore-gray-dark mt-1">
                {subscription.package.title} — {subscription.sessions_remaining} sesiones restantes
              </p>
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
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onBack}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border border-kore-gray-light/50 text-sm font-medium text-kore-gray-dark/60 hover:bg-kore-cream transition-colors disabled:opacity-50"
          >
            Atrás
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-kore-red text-white text-sm font-semibold hover:bg-kore-red/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
