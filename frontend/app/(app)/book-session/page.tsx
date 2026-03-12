'use client';

import { Suspense, useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore, type Slot } from '@/lib/stores/bookingStore';
import { WHATSAPP_URL } from '@/lib/constants';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import TrainerInfoPanel from '@/app/components/booking/TrainerInfoPanel';
import BookingCalendar from '@/app/components/booking/BookingCalendar';
import TimeSlotPicker from '@/app/components/booking/TimeSlotPicker';
import BookingConfirmation from '@/app/components/booking/BookingConfirmation';
import BookingSuccess from '@/app/components/booking/BookingSuccess';
import NoSessionsModal from '@/app/components/booking/NoSessionsModal';

const WEEKDAY_WINDOWS: Record<number, { startHour: number; endHour: number }[]> = {
  1: [{ startHour: 5, endHour: 13 }, { startHour: 16, endHour: 21 }], // Mon
  2: [{ startHour: 5, endHour: 13 }, { startHour: 16, endHour: 21 }], // Tue
  3: [{ startHour: 5, endHour: 13 }, { startHour: 16, endHour: 21 }], // Wed
  4: [{ startHour: 5, endHour: 13 }, { startHour: 16, endHour: 21 }], // Thu
  5: [{ startHour: 5, endHour: 13 }, { startHour: 16, endHour: 21 }], // Fri
  6: [{ startHour: 6, endHour: 13 }],                                  // Sat
  // 0: Sunday — closed
};
const SLOT_STEP_MINUTES = 15;
const TRAVEL_BUFFER_MINUTES = 45;
const DEFAULT_SESSION_DURATION_MINUTES = 60;
const AVAILABILITY_HORIZON_DAYS = 30;

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hasTravelBufferConflict(
  slotStart: Date,
  slotEnd: Date,
  dayBookedSlots: Array<{ starts_at: string; ends_at: string }>,
) {
  const bufferMs = TRAVEL_BUFFER_MINUTES * 60 * 1000;
  const slotStartMs = slotStart.getTime();
  const slotEndMs = slotEnd.getTime();

  return dayBookedSlots.some((booked) => {
    const bookedStartMs = new Date(booked.starts_at).getTime();
    const bookedEndMs = new Date(booked.ends_at).getTime();
    return slotStartMs < bookedEndMs + bufferMs && slotEndMs > bookedStartMs - bufferMs;
  });
}

function BookSessionContent() {
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
    bookingResult,
    dayBookedSlots,
    dayAvailabilityLoading,
    loading,
    error,
    fetchTrainers,
    fetchSlots,
    fetchTrainerDayBookings,
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
  const [slotResolutionError, setSlotResolutionError] = useState<string | null>(null);
  const [confirmInFlight, setConfirmInFlight] = useState(false);

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

  // Fetch occupied sessions only for the selected day and trainer.
  useEffect(() => {
    fetchTrainerDayBookings(selectedDate ?? undefined, trainer?.id);
  }, [selectedDate, trainer?.id, fetchTrainerDayBookings]);

  useEffect(() => {
    setSlotResolutionError(null);
  }, [selectedDate, selectedSlot?.id]);

  // Build set of selectable dates using the fixed weekly schedule pattern.
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < AVAILABILITY_HORIZON_DAYS; offset += 1) {
      const day = new Date(today);
      day.setDate(today.getDate() + offset);

      const weekDay = day.getDay();
      if (!WEEKDAY_WINDOWS[weekDay]) continue;

      if (minSlotStartTime) {
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        if (dayEnd < minSlotStartTime) continue;
      }

      if (maxSlotEndTime) {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        if (dayStart > maxSlotEndTime) continue;
      }

      dates.add(toDateKey(day));
    }

    return dates;
  }, [minSlotStartTime, maxSlotEndTime]);

  // Build virtual slots for the selected date from fixed windows and booked-day conflicts.
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    if (!trainer?.id) return [];

    const selectedDay = new Date(`${selectedDate}T00:00:00`).getDay();
    const dayWindows = WEEKDAY_WINDOWS[selectedDay];
    if (!dayWindows) return [];

    const slotDurationMinutes = trainer?.session_duration_minutes ?? DEFAULT_SESSION_DURATION_MINUTES;
    const slotStepMs = SLOT_STEP_MINUTES * 60 * 1000;
    const slotDurationMs = slotDurationMinutes * 60 * 1000;
    const nowMs = Date.now();

    const generated: Slot[] = [];
    let virtualId = -1;

    dayWindows.forEach(({ startHour, endHour }) => {
      const startHourStr = String(startHour).padStart(2, '0');
      const endHourStr = String(endHour).padStart(2, '0');
      const windowStart = new Date(`${selectedDate}T${startHourStr}:00:00`);
      const windowEnd = new Date(`${selectedDate}T${endHourStr}:00:00`);

      for (
        let cursorMs = windowStart.getTime();
        cursorMs < windowEnd.getTime();
        cursorMs += slotStepMs
      ) {
        const slotStart = new Date(cursorMs);
        const slotEnd = new Date(cursorMs + slotDurationMs);

        if (slotEnd.getTime() > windowEnd.getTime()) break;
        if (slotEnd.getTime() <= nowMs) continue;
        if (slotStart.getTime() < nowMs + 16 * 60 * 60 * 1000) continue;
        if (minSlotStartTime && slotStart < minSlotStartTime) continue;
        if (maxSlotEndTime && slotEnd > maxSlotEndTime) continue;
        if (hasTravelBufferConflict(slotStart, slotEnd, dayBookedSlots)) continue;

        generated.push({
          id: virtualId,
          trainer_id: trainer?.id ?? null,
          starts_at: slotStart.toISOString(),
          ends_at: slotEnd.toISOString(),
          is_active: true,
          is_blocked: false,
        });
        virtualId -= 1;
      }
    });

    return generated;
  }, [
    dayBookedSlots,
    maxSlotEndTime,
    minSlotStartTime,
    selectedDate,
    trainer?.id,
    trainer?.session_duration_minutes,
  ]);

  const showRescheduleNoAvailability =
    isReschedule &&
    bookingToReschedule &&
    selectedDate &&
    !dayAvailabilityLoading &&
    slotsForDate.length === 0;

  const handleConfirm = useCallback(async () => {
    if (!selectedSlot || confirmInFlight) return;

    setConfirmInFlight(true);
    setSlotResolutionError(null);

    try {
      let resolvedSlotId = selectedSlot.id;
      if (selectedSlot.id < 0 && selectedDate) {
        if (!trainer?.id) {
          setSlotResolutionError('No se pudo identificar el entrenador para validar el horario.');
          return;
        }

        await fetchSlots(selectedDate, trainer.id);
        const { slots: realDaySlots, error: slotFetchError } = useBookingStore.getState();

        if (slotFetchError) {
          setSlotResolutionError(slotFetchError);
          return;
        }

        const selectedStartMs = new Date(selectedSlot.starts_at).getTime();
        const selectedEndMs = new Date(selectedSlot.ends_at).getTime();
        const matched = realDaySlots.find(
          (slot) => (
            new Date(slot.starts_at).getTime() === selectedStartMs
            && new Date(slot.ends_at).getTime() === selectedEndMs
          ),
        );

        if (!matched) {
          setSlotResolutionError('El horario ya no está disponible. Intenta con otro.');
          return;
        }

        resolvedSlotId = matched.id;
      }

      if (isReschedule && rescheduleBookingId) {
        await rescheduleBooking(rescheduleBookingId, resolvedSlotId);
        return;
      }
      if (!activeSub) return;
      await createBooking({
        package_id: activeSub.package.id,
        slot_id: resolvedSlotId,
        trainer_id: trainer?.id,
        subscription_id: activeSub.id,
      });
    } finally {
      setConfirmInFlight(false);
    }
  }, [
    activeSub,
    confirmInFlight,
    createBooking,
    fetchSlots,
    isReschedule,
    rescheduleBooking,
    rescheduleBookingId,
    selectedDate,
    selectedSlot,
    trainer?.id,
  ]);

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

      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16">
        {/* Header */}
        <div data-hero="badge" className="mb-8">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Agendar</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Agenda tu sesión
          </h1>
        </div>

        {/* Session Progress Card - Mobile only */}
        {activeSub && (
          <div data-hero="heading" className="mb-6 lg:hidden">
            <div className="p-5 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-kore-red">
                    Sesión {activeSub.sessions_used + 1} de {activeSub.sessions_total}
                  </p>
                  <p className="text-xs text-kore-gray-dark/50 mt-1">
                    {activeSub.package.title} · {activeSub.sessions_used} completadas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-kore-gray-light/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-kore-red to-kore-burgundy rounded-full transition-all duration-500"
                      style={{ width: `${activeSub.sessions_total > 0 ? (activeSub.sessions_used / activeSub.sessions_total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-kore-red">
                    {Math.round((activeSub.sessions_used / activeSub.sessions_total) * 100)}%
                  </span>
                </div>
              </div>
            </div>
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
                <span className="text-sm text-kore-gray-dark/50">
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
          <div data-hero="body" className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6 ${hasNoSessions ? 'opacity-50 pointer-events-none' : ''}`}>
            {showRescheduleNoAvailability && (
              <div className="md:col-span-2 xl:col-span-12">
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
            {/* Left — Session progress + Trainer info (tablet/desktop) */}
            <div className="hidden lg:block lg:col-span-1 xl:col-span-3 space-y-4">
              {/* Session Progress Card - Desktop */}
              {activeSub && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-kore-red">
                      Sesión {activeSub.sessions_used + 1} de {activeSub.sessions_total}
                    </p>
                    <p className="text-xs text-kore-gray-dark/50">
                      {activeSub.package.title} · {activeSub.sessions_used} completadas
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-kore-gray-light/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-kore-red to-kore-burgundy rounded-full transition-all duration-500"
                          style={{ width: `${activeSub.sessions_total > 0 ? (activeSub.sessions_used / activeSub.sessions_total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-kore-red">
                        {Math.round((activeSub.sessions_used / activeSub.sessions_total) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* Trainer Card */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50 sticky top-8">
                <TrainerInfoPanel trainer={trainer} />
              </div>
            </div>

            {/* Center — Calendar */}
            <div className="md:col-span-1 lg:col-span-1 xl:col-span-5">
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
            <div className="md:col-span-2 lg:col-span-2 xl:col-span-4">
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
                    {dayAvailabilityLoading && (
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
              loading={confirmInFlight}
              error={slotResolutionError ?? error}
              onConfirm={handleConfirm}
              onBack={() => {
                setSlotResolutionError(null);
                setStep(1);
              }}
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

export default function BookSessionPage() {
  return (
    <Suspense fallback={
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    }>
      <BookSessionContent />
    </Suspense>
  );
}
