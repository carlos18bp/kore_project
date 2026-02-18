'use client';

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { WHATSAPP_URL } from '@/lib/constants';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import TrainerInfoPanel from '@/app/components/booking/TrainerInfoPanel';
import BookingCalendar from '@/app/components/booking/BookingCalendar';
import TimeSlotPicker from '@/app/components/booking/TimeSlotPicker';
import BookingConfirmation from '@/app/components/booking/BookingConfirmation';
import BookingSuccess from '@/app/components/booking/BookingSuccess';
import NoSessionsModal from '@/app/components/booking/NoSessionsModal';

export default function BookSessionPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
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
    fetchBookings,
    bookings,
    createBooking,
    rescheduleBooking,
    reset,
    subscriptions,
  } = useBookingStore();

  const rescheduleParam = searchParams.get('reschedule');
  const subscriptionParam = searchParams.get('subscription');
  const rescheduleBookingId = useMemo(() => {
    if (!rescheduleParam) return null;
    const parsed = Number(rescheduleParam);
    return Number.isFinite(parsed) ? parsed : null;
  }, [rescheduleParam]);
  const subscriptionIdParam = useMemo(() => {
    if (!subscriptionParam) return null;
    const parsed = Number(subscriptionParam);
    return Number.isFinite(parsed) ? parsed : null;
  }, [subscriptionParam]);
  const isReschedule = rescheduleBookingId !== null;
  const rescheduleSubscriptionId = isReschedule ? subscriptionIdParam : null;

  // Load trainers and subscriptions on mount
  useEffect(() => {
    fetchTrainers();
    fetchSubscriptions();
  }, [fetchTrainers, fetchSubscriptions]);

  // Get all active subscriptions
  const activeSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status === 'active'),
    [subscriptions],
  );

  // Filter subscriptions based on entry point
  const selectableSubscriptions = useMemo(() => {
    if (isReschedule) {
      if (rescheduleSubscriptionId) {
        return activeSubscriptions.filter((sub) => sub.id === rescheduleSubscriptionId);
      }
      return activeSubscriptions;
    }
    return activeSubscriptions.filter((sub) => sub.sessions_remaining > 0);
  }, [activeSubscriptions, isReschedule, rescheduleSubscriptionId]);

  // Selected subscription ID (default: query param or first active)
  const [selectedSubId, setSelectedSubId] = useState<number | null>(subscriptionIdParam);

  useEffect(() => {
    if (isReschedule && rescheduleSubscriptionId && selectedSubId !== rescheduleSubscriptionId) {
      setSelectedSubId(rescheduleSubscriptionId);
    }
  }, [isReschedule, rescheduleSubscriptionId, selectedSubId]);

  // Set default selection when subscriptions load (fallback if invalid selection)
  useEffect(() => {
    if (selectableSubscriptions.length === 0) return;
    const isValidSelection = selectedSubId !== null
      && selectableSubscriptions.some((sub) => sub.id === selectedSubId);
    if (!isValidSelection) {
      setSelectedSubId(selectableSubscriptions[0].id);
    }
  }, [selectableSubscriptions, selectedSubId]);

  // Reset stale success state on mount only.
  // The store is global so step/bookingResult may persist across navigations.
  // On remount we clear it; for same-URL navigation the modal stays visible
  // and the user can dismiss it.
  useEffect(() => {
    if (step === 3 || bookingResult) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Currently selected subscription
  const activeSub = useMemo(
    () => selectableSubscriptions.find((s) => s.id === selectedSubId) ?? selectableSubscriptions[0] ?? null,
    [selectableSubscriptions, selectedSubId],
  );

  // Check if user has no remaining sessions on selected subscription
  const hasNoSessions = !isReschedule && activeSubscriptions.length > 0 && selectableSubscriptions.length === 0;

  // Fetch bookings for selected subscription when it changes
  useEffect(() => {
    if (selectedSubId) {
      fetchBookings(selectedSubId);
    }
  }, [selectedSubId, fetchBookings]);

  const activeBookings = useMemo(
    () => bookings.filter(
      (b) =>
        b.subscription_id_display === selectedSubId &&
        (b.status === 'pending' || b.status === 'confirmed'),
    ),
    [bookings, selectedSubId],
  );

  const bookingToReschedule = useMemo(() => {
    if (!isReschedule || !rescheduleBookingId) return null;
    return activeBookings.find((b) => b.id === rescheduleBookingId) ?? null;
  }, [activeBookings, isReschedule, rescheduleBookingId]);

  const rescheduleNeighbors = useMemo(() => {
    if (!bookingToReschedule) return { previous: null, next: null };
    const ordered = [...activeBookings].sort(
      (a, b) => new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime(),
    );
    const index = ordered.findIndex((b) => b.id === bookingToReschedule.id);
    return {
      previous: index > 0 ? ordered[index - 1] : null,
      next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null,
    };
  }, [activeBookings, bookingToReschedule]);

  const lastActiveBooking = useMemo(() => {
    if (isReschedule) return null;
    if (activeBookings.length === 0) return null;
    return [...activeBookings].sort(
      (a, b) => new Date(b.slot.ends_at).getTime() - new Date(a.slot.ends_at).getTime(),
    )[0];
  }, [activeBookings, isReschedule]);

  // Minimum allowed slot start time
  const minSlotStartTime = useMemo(() => {
    if (isReschedule && bookingToReschedule) {
      return rescheduleNeighbors.previous ? new Date(rescheduleNeighbors.previous.slot.ends_at) : null;
    }
    if (!lastActiveBooking) return null;
    return new Date(lastActiveBooking.slot.ends_at);
  }, [bookingToReschedule, isReschedule, lastActiveBooking, rescheduleNeighbors.previous]);

  // Maximum allowed slot end time for reschedule (before next session starts)
  const maxSlotEndTime = useMemo(() => {
    if (!isReschedule || !bookingToReschedule) return null;
    return rescheduleNeighbors.next ? new Date(rescheduleNeighbors.next.slot.starts_at) : null;
  }, [bookingToReschedule, isReschedule, rescheduleNeighbors.next]);

  // Fetch all future slots (no date filter) so the calendar can show available days
  useEffect(() => {
    fetchMonthSlots(trainer?.id);
  }, [trainer?.id, fetchMonthSlots]);

  // Build set of available dates from all future slots (filtered by chronological order)
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    monthSlots.forEach((s) => {
      // Filter out slots that start before the last session ends
      if (minSlotStartTime && new Date(s.starts_at) < minSlotStartTime) return;
      if (maxSlotEndTime && new Date(s.ends_at) > maxSlotEndTime) return;
      const d = new Date(s.starts_at).toISOString().slice(0, 10);
      dates.add(d);
    });
    return dates;
  }, [monthSlots, minSlotStartTime, maxSlotEndTime]);

  // Filter slots for selected date (filtered by chronological order)
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return monthSlots.filter((s) => {
      // Filter out slots that start before the last session ends
      if (minSlotStartTime && new Date(s.starts_at) < minSlotStartTime) return false;
      if (maxSlotEndTime && new Date(s.ends_at) > maxSlotEndTime) return false;
      return new Date(s.starts_at).toISOString().slice(0, 10) === selectedDate;
    });
  }, [monthSlots, selectedDate, minSlotStartTime, maxSlotEndTime]);

  const showRescheduleNoAvailability =
    isReschedule &&
    bookingToReschedule &&
    !loading &&
    availableDates.size === 0;

  const handleConfirm = useCallback(async () => {
    if (!selectedSlot) return;
    if (isReschedule && rescheduleBookingId) {
      await rescheduleBooking(rescheduleBookingId, selectedSlot.id);
      return;
    }
    if (!activeSub) return;
    await createBooking({
      package_id: activeSub.package.id,
      slot_id: selectedSlot.id,
      trainer_id: trainer?.id,
      subscription_id: activeSub.id,
    });
  }, [selectedSlot, activeSub, trainer, createBooking, isReschedule, rescheduleBookingId, rescheduleBooking]);

  const handleReset = useCallback(() => {
    reset();
    fetchSubscriptions();
    if (isReschedule) {
      router.replace('/book-session');
    }
  }, [reset, fetchSubscriptions, isReschedule, router]);

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      {/* No Sessions Modal */}
      {hasNoSessions && <NoSessionsModal packageTitle={activeSub?.package.title} />}

      <div className="w-full px-6 md:px-10 lg:px-16 pt-8 pb-16">
        {/* Header */}
        <div data-hero="badge" className="mb-8">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Agendar</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Agenda tu sesión
          </h1>
        </div>

        {/* Subscription Selector */}
        {selectableSubscriptions.length > 0 && (
          <div data-hero="heading" className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label htmlFor="subscription-select" className="text-sm font-medium text-kore-gray-dark">
                Selecciona tu programa:
              </label>
              <select
                id="subscription-select"
                value={selectedSubId ?? ''}
                onChange={(e) => setSelectedSubId(Number(e.target.value))}
                disabled={isReschedule}
                className="px-4 py-2 rounded-xl border border-kore-gray-light/50 bg-white text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/30 cursor-pointer"
              >
                {selectableSubscriptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.package.title} — {sub.sessions_remaining} sesiones restantes
                  </option>
                ))}
              </select>
            </div>
            {/* Session Details */}
            {activeSub && (
              <div className="mt-4 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-kore-gray-light/50">
                <p className="text-sm font-medium text-kore-gray-dark">
                  <span className="text-kore-red font-semibold">
                    Sesión {activeSub.sessions_used + 1} de {activeSub.sessions_total}
                  </span>
                  {' — '}
                  {activeSub.sessions_remaining} {activeSub.sessions_remaining === 1 ? 'sesión restante' : 'sesiones restantes'}
                </p>
                <p className="text-xs text-kore-gray-dark/50 mt-1">
                  Programa: {activeSub.package.title}
                </p>
              </div>
            )}
          </div>
        )}

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

        {/* Step 1 — Calendar + Slots (also visible behind success modal at step 3) */}
        {(step === 1 || step === 3) && (
          <div data-hero="body" className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${hasNoSessions ? 'opacity-50 pointer-events-none' : ''}`}>
            {showRescheduleNoAvailability && (
              <div className="lg:col-span-12">
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-kore-gray-light/50">
                  <p className="text-sm text-kore-gray-dark/70">
                    Por el momento no hay disponibilidad horaria. Por favor contacta a tu entrenador vía WhatsApp al{' '}
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-kore-red font-semibold hover:underline cursor-pointer"
                    >
                      +57 301 4645272
                    </a>
                    {' '}o intenta más tarde.
                  </p>
                </div>
              </div>
            )}
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
                    if (!hasNoSessions) {
                      setSelectedDate(date);
                    }
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
                        if (!hasNoSessions) {
                          setSelectedSlot(slot);
                          setStep(2);
                        }
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

      </div>

      {/* Success modal (overlays on top of the page) */}
      {step === 3 && bookingResult && (
        <BookingSuccess booking={bookingResult} onReset={handleReset} />
      )}
    </section>
  );
}
