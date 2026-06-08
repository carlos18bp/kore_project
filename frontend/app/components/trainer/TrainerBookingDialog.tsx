'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBookingStore } from '@/lib/stores/bookingStore';
import BookingCalendar from '@/app/components/booking/BookingCalendar';
import TimeSlotPicker from '@/app/components/booking/TimeSlotPicker';
import ResponsiveSheet from './ResponsiveSheet';

type CreateProps = {
  mode: 'create';
  customerId: number;
  customerName: string;
  packageId: number;
  subscriptionId: number | null;
  onClose: () => void;
  onSuccess: () => void;
};

type RescheduleProps = {
  mode: 'reschedule';
  customerId: number;
  customerName: string;
  bookingId: number;
  currentStartsAt: string;
  onClose: () => void;
  onSuccess: () => void;
};

type Props = CreateProps | RescheduleProps;

type Step = 1 | 2 | 3;

function localDateStr(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLong(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function TrainerBookingDialog(props: Props) {
  const { mode, customerName, onClose, onSuccess } = props;

  const {
    availability, availabilityLoading,
    fetchAvailability, createBooking, rescheduleBooking,
    error,
  } = useBookingStore();

  const [step, setStep] = useState<Step>(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStartsAt, setSelectedStartsAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch a 30-day window of availability on mount. Backend defaults trainer
  // to request.user.trainer_profile when no ?trainer= param is sent.
  useEffect(() => {
    const today = new Date();
    const start = localDateStr(today.toISOString());
    const endDate = new Date(today.getTime() + 30 * 86400000);
    const end = localDateStr(endDate.toISOString());
    fetchAvailability(start, end);
  }, [fetchAvailability]);

  const availableDates = useMemo(
    () => new Set(Object.keys(availability)),
    [availability],
  );

  const slotsForSelected = selectedDate ? availability[selectedDate] ?? [] : [];

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedStartsAt(null);
    setStep(2);
  }

  function handleSelectSlot(startsAt: string) {
    setSelectedStartsAt(startsAt);
    setStep(3);
  }

  async function handleSubmit() {
    if (!selectedStartsAt) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      if (mode === 'create') {
        const { customerId, packageId, subscriptionId } = props;
        const result = await createBooking({
          package_id: packageId,
          starts_at: selectedStartsAt,
          customer_id: customerId,
          ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
        });
        if (!result) {
          setLocalError(useBookingStore.getState().error ?? 'No se pudo agendar la sesión.');
          return;
        }
      } else {
        const result = await rescheduleBooking(props.bookingId, selectedStartsAt);
        if (!result) {
          setLocalError(useBookingStore.getState().error ?? 'No se pudo reprogramar la sesión.');
          return;
        }
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  const headerTitle = mode === 'create' ? 'Agendar sesión' : 'Reprogramar sesión';

  return (
    <ResponsiveSheet onClose={success ? () => { onSuccess(); onClose(); } : onClose}>
      <div className="flex flex-col px-5 pb-6 pt-2 max-h-[85dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-kore-wine-dark/8">
          <div>
            <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase text-kore-wine-dark/55">
              {headerTitle}
            </p>
            <p className="font-heading text-[17px] font-semibold text-kore-wine-dark mt-0.5">
              {customerName}
            </p>
            {mode === 'reschedule' && (
              <p className="font-body text-[12px] text-kore-wine-dark/50 mt-1">
                Actual: {formatLong(props.currentStartsAt)} · {formatTime(props.currentStartsAt)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-kore-wine-dark/40 hover:text-kore-wine-dark transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {success ? (
          <div className="py-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-kore-sage/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-kore-sage-deep" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="font-heading text-[16px] font-semibold text-kore-wine-dark">
              {mode === 'create' ? '¡Sesión agendada!' : '¡Sesión reprogramada!'}
            </p>
            {selectedStartsAt && (
              <p className="font-body text-[13px] text-kore-wine-dark/55">
                {formatLong(selectedStartsAt)} · {formatTime(selectedStartsAt)}
              </p>
            )}
            <button
              onClick={() => { onSuccess(); onClose(); }}
              className="mt-4 inline-flex items-center justify-center bg-kore-red text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-kore-red-dark transition-colors"
            >
              Listo
            </button>
          </div>
        ) : (
          <div className="pt-4 space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    step >= s ? 'bg-kore-red' : 'bg-kore-wine-dark/10'
                  }`}
                />
              ))}
            </div>

            {step === 1 && (
              <div>
                {availabilityLoading && (
                  <p className="text-center text-xs text-kore-wine-dark/40 mb-2">Cargando horarios…</p>
                )}
                {!availabilityLoading && availableDates.size === 0 && (
                  <p className="text-center text-sm text-kore-wine-dark/50 py-8">
                    No hay disponibilidad en los próximos 30 días.
                  </p>
                )}
                {availableDates.size > 0 && (
                  <BookingCalendar
                    availableDates={availableDates}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                  />
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-xs font-semibold text-kore-wine-dark/55 hover:text-kore-wine-dark transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Cambiar día
                </button>
                <p className="font-body text-[12px] font-semibold uppercase tracking-wide text-kore-wine-dark/55">
                  {selectedDate && formatLong(selectedDate + 'T12:00:00Z')}
                </p>
                <TimeSlotPicker
                  slots={slotsForSelected}
                  selectedStartsAt={selectedStartsAt}
                  onSelect={handleSelectSlot}
                />
              </div>
            )}

            {step === 3 && selectedStartsAt && (
              <div className="space-y-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1 text-xs font-semibold text-kore-wine-dark/55 hover:text-kore-wine-dark transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Cambiar horario
                </button>

                <div className="rounded-2xl bg-kore-cream/50 border border-kore-wine-dark/8 p-4 space-y-1">
                  <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase text-kore-wine-dark/55">
                    Confirmar sesión
                  </p>
                  <p className="font-heading text-[16px] font-semibold text-kore-wine-dark">
                    {formatLong(selectedStartsAt)}
                  </p>
                  <p className="font-body text-[13px] text-kore-wine-dark/55">
                    {formatTime(selectedStartsAt)}
                  </p>
                </div>

                {mode === 'create' && props.subscriptionId === null && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    Este cliente no tiene una suscripción activa; la sesión quedará registrada pero no descontará un cupo.
                  </p>
                )}

                {(localError || error) && (
                  <p className="text-xs text-kore-crimson bg-red-50 border border-red-200 rounded-xl p-3">
                    {localError ?? error}
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-kore-red text-white rounded-xl py-3 font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? (mode === 'create' ? 'Agendando…' : 'Reprogramando…')
                    : (mode === 'create' ? 'Confirmar y agendar' : 'Confirmar reprogramación')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
