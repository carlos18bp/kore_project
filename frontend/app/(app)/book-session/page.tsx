'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import TrainerInfoPanel from '@/app/components/booking/TrainerInfoPanel';
import BookingCalendar from '@/app/components/booking/BookingCalendar';
import TimeSlotPicker from '@/app/components/booking/TimeSlotPicker';
import BookingConfirmation from '@/app/components/booking/BookingConfirmation';
import BookingSuccess from '@/app/components/booking/BookingSuccess';

export default function BookSessionPage() {
  const { user } = useAuthStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const {
    step,
    setStep,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    trainer,
    subscription,
    bookingResult,
    monthSlots,
    loading,
    error,
    fetchTrainers,
    fetchMonthSlots,
    fetchSubscriptions,
    createBooking,
    reset,
    subscriptions,
  } = useBookingStore();

  // Load trainers and subscriptions on mount
  useEffect(() => {
    fetchTrainers();
    fetchSubscriptions();
  }, [fetchTrainers, fetchSubscriptions]);

  // Pick first active subscription as default
  const activeSub = useMemo(
    () => subscriptions.find((s) => s.status === 'active') ?? null,
    [subscriptions],
  );

  // Fetch all future slots (no date filter) so the calendar can show available days
  useEffect(() => {
    fetchMonthSlots(trainer?.id);
  }, [trainer?.id, fetchMonthSlots]);

  // Build set of available dates from all future slots
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    monthSlots.forEach((s) => {
      const d = new Date(s.starts_at).toISOString().slice(0, 10);
      dates.add(d);
    });
    return dates;
  }, [monthSlots]);

  // Filter slots for selected date
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return monthSlots.filter((s) => new Date(s.starts_at).toISOString().slice(0, 10) === selectedDate);
  }, [monthSlots, selectedDate]);

  const handleConfirm = useCallback(async () => {
    if (!selectedSlot || !activeSub) return;
    await createBooking({
      package_id: activeSub.package.id,
      slot_id: selectedSlot.id,
      trainer_id: trainer?.id,
      subscription_id: activeSub.id,
    });
  }, [selectedSlot, activeSub, trainer, createBooking]);

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
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Agendar</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Agenda tu sesión
          </h1>
        </div>

        {/* Step indicator */}
        {step < 3 && (
          <div data-hero="heading" className="flex items-center gap-2 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    step >= s
                      ? 'bg-kore-red text-white'
                      : 'bg-kore-gray-light/40 text-kore-gray-dark/40'
                  }`}
                >
                  {s}
                </div>
                <span className="text-sm text-kore-gray-dark/50 hidden sm:inline">
                  {s === 1 ? 'Seleccionar horario' : 'Confirmar'}
                </span>
                {s < 2 && (
                  <div className="w-8 h-px bg-kore-gray-light/60 mx-1" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1 — Calendar + Slots */}
        {step === 1 && (
          <div data-hero="body" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left — Trainer info (desktop) */}
            <div className="lg:col-span-3 hidden lg:block">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50 sticky top-8">
                <TrainerInfoPanel trainer={trainer} selectedSlot={selectedSlot} />
              </div>
            </div>

            {/* Center — Calendar */}
            <div className="lg:col-span-5">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
                <BookingCalendar
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                  }}
                />
              </div>
            </div>

            {/* Right — Time slots */}
            <div className="lg:col-span-4">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
                <h3 className="font-heading text-base font-semibold text-kore-gray-dark mb-4">
                  {selectedDate
                    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })
                    : 'Selecciona un día'}
                </h3>
                {selectedDate ? (
                  <>
                    <TimeSlotPicker
                      slots={slotsForDate}
                      selectedSlot={selectedSlot}
                      onSelectSlot={(slot) => {
                        setSelectedSlot(slot);
                        setStep(2);
                      }}
                    />
                    {loading && (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin h-5 w-5 border-2 border-kore-red border-t-transparent rounded-full" />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-kore-gray-dark/40 py-8 text-center">
                    Selecciona una fecha en el calendario para ver los horarios disponibles.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Confirmation */}
        {step === 2 && selectedSlot && (
          <div data-hero="body">
            <BookingConfirmation
              trainer={trainer}
              slot={selectedSlot}
              subscription={activeSub}
              loading={loading}
              error={error}
              onConfirm={handleConfirm}
              onBack={() => setStep(1)}
            />
          </div>
        )}

        {/* Step 3 — Success */}
        {step === 3 && bookingResult && (
          <div data-hero="body">
            <BookingSuccess booking={bookingResult} onReset={reset} />
          </div>
        )}
      </div>
    </section>
  );
}
