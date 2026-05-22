'use client';

import { Suspense, useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { X, ArrowRight, ArrowDown, Calendar, CalendarPlus } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { WHATSAPP_URL } from '@/lib/constants';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import BookingCalendar from '@/app/components/booking/BookingCalendar';
import TimeSlotPicker from '@/app/components/booking/TimeSlotPicker';
import BookingConfirmation from '@/app/components/booking/BookingConfirmation';
import BookingSuccess from '@/app/components/booking/BookingSuccess';
import NoSessionsModal from '@/app/components/booking/NoSessionsModal';
import UpcomingSessionsCard from '@/app/components/booking/UpcomingSessionsCard';

const BOOKING_HERO_STYLES = `
  @keyframes book-orb-1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.15)}}
  @keyframes book-orb-2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,40px) scale(0.9)}}
  @keyframes book-orb-3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,30px) scale(1.1)}}
  @keyframes book-aurora{0%,100%{opacity:0.45}50%{opacity:0.85}}
  @keyframes book-shell-fade{from{opacity:0}to{opacity:1}}
  @keyframes book-shell-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
`;

function BookingShell({
  children,
  step,
  containerRef,
}: {
  children: React.ReactNode;
  step?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={containerRef}
      className="fixed inset-0 z-[55] overflow-y-auto overflow-x-hidden"
    >
      <style>{BOOKING_HERO_STYLES}</style>
      <div
        className="relative min-h-screen w-full overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
          animation: 'book-shell-fade 280ms ease-out both',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 80% 20%, rgba(255,233,220,0.20) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(20,5,12,0.65) 0%, transparent 55%)',
            animation: 'book-aurora 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '15%', right: '10%', width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)',
            filter: 'blur(40px)', animation: 'book-orb-1 9s ease-in-out infinite',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '10%', left: '15%', width: 260, height: 260, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)',
            filter: 'blur(50px)', animation: 'book-orb-2 11s ease-in-out infinite',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '50%', right: '40%', width: 160, height: 160, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168,194,156,0.18) 0%, transparent 70%)',
            filter: 'blur(40px)', animation: 'book-orb-3 13s ease-in-out infinite',
          }}
        />

        <div
          className="relative z-10 max-w-3xl mx-auto w-full px-5 pt-6 flex items-center justify-between"
          style={{ animation: 'book-shell-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both' }}
        >
          <Link
            href="/dashboard"
            aria-label="Volver al panel"
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center hover:bg-white/15 transition-colors active:scale-95"
          >
            <X className="w-4 h-4 text-white/80" strokeWidth={2} />
          </Link>
          {typeof step === 'number' && step < 3 && (
            <div className="flex items-center gap-2.5">
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/55 font-semibold">
                Paso {step} de 2
              </span>
              <div className="flex items-center gap-1">
                {[1, 2].map((s) => (
                  <div
                    key={s}
                    className={`h-1 rounded-full transition-all ${
                      s === step
                        ? 'w-8 bg-kore-red'
                        : s < step
                        ? 'w-4 bg-white/55'
                        : 'w-4 bg-white/15'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="relative z-10 max-w-3xl mx-auto w-full px-5 pt-6 pb-12"
          style={{ animation: 'book-shell-rise 460ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both' }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

// Ventana de agendamiento: el backend permite reservar hasta 30 días (BOOKING_HORIZON_DAYS).
const BOOKING_HORIZON_DAYS = 30;

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function BookSessionContent() {
  const { user } = useAuthStore();
  const { hasOwnActiveSubscription, subscriptionsLoaded } = useSubscriptionStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  const {
    step,
    setStep,
    selectedDate,
    setSelectedDate,
    selectedStartsAt,
    setSelectedStartsAt,
    trainer,
    bookingResult,
    availability,
    availabilityLoading,
    loading,
    error,
    fetchTrainers,
    fetchAvailability,
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
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmInFlight, setConfirmInFlight] = useState(false);

  // Load trainers and subscriptions on mount
  useEffect(() => {
    fetchTrainers();
    fetchSubscriptions();
  }, [fetchTrainers, fetchSubscriptions]);

  // Sync the assigned trainer from the auth profile into the booking store.
  const assignedTrainer = user?.assigned_trainer ?? null;
  useEffect(() => {
    if (!isReschedule) {
      useBookingStore.getState().setTrainerFromAssigned(assignedTrainer);
    }
  }, [assignedTrainer, isReschedule]);

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

  useEffect(() => {
    if (selectableSubscriptions.length === 0) return;
    const isValidSelection = selectedSubId !== null
      && selectableSubscriptions.some((sub) => sub.id === selectedSubId);
    if (!isValidSelection) {
      setSelectedSubId(selectableSubscriptions[0].id);
    }
  }, [selectableSubscriptions, selectedSubId]);

  // Reset stale success state on mount only.
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

  // For reschedule flow, populate store trainer from the booking being rescheduled.
  useEffect(() => {
    if (isReschedule && bookingToReschedule?.trainer) {
      useBookingStore.setState({ trainer: bookingToReschedule.trainer });
    }
  }, [isReschedule, bookingToReschedule?.trainer]);

  // Fetch availability from the backend whenever trainer is known.
  // Pedimos la ventana completa de 30 días; sin date_from/date_to el backend
  // sólo devuelve 7 días por defecto.
  useEffect(() => {
    if (trainer?.id) {
      const today = new Date();
      const horizon = new Date(today);
      horizon.setDate(horizon.getDate() + BOOKING_HORIZON_DAYS - 1);
      fetchAvailability(toDateKey(today), toDateKey(horizon), trainer.id);
    }
  }, [trainer?.id, fetchAvailability]);

  useEffect(() => {
    setConfirmError(null);
  }, [selectedDate, selectedStartsAt]);

  // Available dates = keys of availability with at least one start time.
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    for (const [date, slots] of Object.entries(availability)) {
      if (slots.length > 0) dates.add(date);
    }
    return dates;
  }, [availability]);

  // Days with a non-canceled future booked session — get a marker dot.
  const bookedDates = useMemo(() => {
    const dates = new Set<string>();
    const nowMs = Date.now();
    for (const b of bookings) {
      if (b.status === 'canceled') continue;
      const start = new Date(b.starts_at);
      if (start.getTime() <= nowMs) continue;
      dates.add(toDateKey(start));
    }
    return dates;
  }, [bookings]);

  // Slots available for the selected date.
  const slotsForDate = useMemo(
    () => (selectedDate ? (availability[selectedDate] ?? []) : []),
    [availability, selectedDate],
  );

  // Computed end time for the confirmation panel.
  const endsAt = useMemo(() => {
    if (!selectedStartsAt) return '';
    const durationMs = (trainer?.session_duration_minutes ?? 60) * 60 * 1000;
    return new Date(new Date(selectedStartsAt).getTime() + durationMs).toISOString();
  }, [selectedStartsAt, trainer?.session_duration_minutes]);

  // Show a "contact trainer" notice when availability is fully loaded but empty.
  const showRescheduleNoAvailability =
    isReschedule &&
    !availabilityLoading &&
    availableDates.size === 0;

  const handleConfirm = useCallback(async () => {
    if (!selectedStartsAt || confirmInFlight) return;

    setConfirmInFlight(true);
    setConfirmError(null);

    try {
      if (isReschedule && rescheduleBookingId) {
        await rescheduleBooking(rescheduleBookingId, selectedStartsAt);
        return;
      }
      if (!activeSub) return;
      await createBooking({
        package_id: activeSub.package.id,
        starts_at: selectedStartsAt,
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
    isReschedule,
    rescheduleBooking,
    rescheduleBookingId,
    selectedStartsAt,
    trainer?.id,
  ]);

  const handleReset = useCallback(() => {
    reset();
    fetchSubscriptions();
    router.push('/dashboard');
  }, [reset, fetchSubscriptions, router]);

  if (!user) {
    return (
      <section
        className="fixed inset-0 z-[55] flex items-center justify-center"
        style={{ background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)' }}
      >
        <div className="animate-spin h-8 w-8 border-2 border-white/30 border-t-white rounded-full" />
      </section>
    );
  }

  if (user.role === 'customer' && !user.assigned_trainer && !isReschedule) {
    return (
      <BookingShell>
        <div className="w-full max-w-md mx-auto text-center pt-8">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
            <Calendar className="w-7 h-7 text-white/70" strokeWidth={1.5} />
          </div>
          <h1 className="font-heading text-[24px] xl:text-[28px] font-semibold mb-3 leading-tight" style={{ color: '#FFF8EC', letterSpacing: '-0.01em' }}>
            Aún no puedes agendar
          </h1>
          <p className="text-[14px] mb-7 leading-relaxed" style={{ color: '#FFE9DC', opacity: 0.75 }}>
            Estamos asignándote un entrenador. En cuanto te asignen uno podrás reservar tus sesiones desde aquí.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-7 py-3 rounded-xl transition-colors text-sm"
          >
            Volver al inicio
          </Link>
        </div>
      </BookingShell>
    );
  }

  if (subscriptionsLoaded && !hasOwnActiveSubscription) {
    return (
      <BookingShell>
        <div className="w-full max-w-md mx-auto text-center pt-8">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
            <CalendarPlus className="w-6 h-6 text-white/70" strokeWidth={1.5} />
          </div>
          <h2 className="font-heading text-[24px] xl:text-[28px] font-semibold mb-2 leading-tight" style={{ color: '#FFF8EC', letterSpacing: '-0.01em' }}>
            Necesitas un plan activo
          </h2>
          <p className="text-[14px] mb-7 leading-relaxed" style={{ color: '#FFE9DC', opacity: 0.75 }}>
            Para agendar sesiones debes tener un plan activo. Elige el que mejor se adapte a tus metas.
          </p>
          <Link
            href="/programs"
            className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors text-[14px] active:scale-95 transition-transform"
          >
            Ver programas
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </div>
      </BookingShell>
    );
  }

  const subProgressPct = activeSub && activeSub.sessions_total > 0
    ? Math.round((activeSub.sessions_used / activeSub.sessions_total) * 100)
    : 0;

  return (
    <BookingShell step={step} containerRef={sectionRef}>
      {hasNoSessions && <NoSessionsModal packageTitle={activeSub?.package.title} />}

      {/* Header */}
      <div data-hero="badge" className="mb-5 px-1">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold mb-2" style={{ color: '#E7C8A0' }}>
          {isReschedule ? 'Reagendar' : 'Próxima sesión'}
        </p>
        <h1 className="font-heading text-[28px] xl:text-[36px] font-semibold leading-[1.05]" style={{ color: '#FFF8EC', letterSpacing: '-0.015em' }}>
          {step === 2 ? 'Confirma tu horario' : 'Agenda tu sesión'}
        </h1>
        {activeSub && (
          <p className="text-[13px] xl:text-[14px] mt-2" style={{ color: '#FFE9DC', opacity: 0.78 }}>
            Sesión {activeSub.sessions_used + 1} de {activeSub.sessions_total} · {activeSub.package.title}
          </p>
        )}
      </div>

      {/* Subscription progress strip */}
      {activeSub && (
        <div data-hero="heading" className="mb-5 px-1">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${subProgressPct}%`,
                  background: 'linear-gradient(to right, #E00000, #9A0526)',
                  transition: 'width 700ms ease-out',
                }}
              />
            </div>
            <span className="text-[11px] text-white/55 font-semibold tabular-nums shrink-0">{subProgressPct}%</span>
          </div>
        </div>
      )}

      {/* Reschedule no-availability notice */}
      {showRescheduleNoAvailability && (
        <div data-hero="heading" className="mb-4 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur p-4">
          <p className="text-[13px] text-white/75 leading-relaxed">
            Por el momento no hay disponibilidad horaria. Contacta a tu entrenador por WhatsApp al{' '}
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
      )}

      {/* Step 1 — Calendar + Slots */}
      {(step === 1 || step === 3) && (
        <div
          data-hero="body"
          className={`bg-white rounded-3xl shadow-2xl overflow-hidden ${hasNoSessions ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-5 md:p-6 md:border-r border-b md:border-b-0 border-kore-gray-light/30">
              <p className="text-[10.5px] text-kore-gray-dark/40 uppercase tracking-[0.14em] font-semibold mb-3">
                Selecciona un día
              </p>
              {availabilityLoading && availableDates.size === 0 ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-5 w-5 border-2 border-kore-red border-t-transparent rounded-full" />
                </div>
              ) : (
                <BookingCalendar
                  availableDates={availableDates}
                  bookedDates={bookedDates}
                  selectedDate={selectedDate}
                  onSelectDate={(date) => {
                    if (!hasNoSessions) {
                      setSelectedDate(date);
                    }
                  }}
                />
              )}

              {/* Leyenda del puntico + hint hacia las próximas sesiones */}
              {bookedDates.size > 0 && (
                <div className="mt-4 border-t border-kore-gray-light/30 pt-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-kore-red" />
                    <span className="text-[11.5px] text-kore-gray-dark/55">Día con sesión ya agendada</span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-kore-red">
                    <ArrowDown className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.2} />
                    Desliza abajo para ver tus próximas sesiones
                  </p>
                </div>
              )}
            </div>
            <div className="p-5 md:p-6">
              <p className="text-[10.5px] text-kore-gray-dark/40 uppercase tracking-[0.14em] font-semibold mb-1.5">
                Horario
              </p>
              <h3 className="font-heading text-[16px] font-semibold text-kore-wine-dark capitalize leading-tight mb-3">
                {selectedDate
                  ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })
                  : 'Sin fecha'}
              </h3>
              {selectedDate ? (
                availabilityLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin h-5 w-5 border-2 border-kore-red border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <TimeSlotPicker
                    slots={slotsForDate}
                    selectedStartsAt={selectedStartsAt}
                    onSelect={(startsAt) => {
                      if (!hasNoSessions) {
                        setSelectedStartsAt(startsAt);
                        setStep(2);
                      }
                    }}
                  />
                )
              ) : (
                <p className="text-[13px] text-kore-gray-dark/40 py-8 text-center leading-relaxed">
                  Selecciona una fecha en el calendario para ver los horarios disponibles.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Confirmation */}
      {step === 2 && selectedStartsAt && (
        <div data-hero="body" className="bg-white rounded-3xl shadow-2xl p-5 md:p-6">
          <BookingConfirmation
            trainer={trainer}
            startsAt={selectedStartsAt}
            endsAt={endsAt}
            subscription={activeSub}
            loading={confirmInFlight}
            error={confirmError ?? error}
            onConfirm={handleConfirm}
            onBack={() => {
              setConfirmError(null);
              setStep(1);
            }}
          />
        </div>
      )}

      {/* Upcoming / past sessions for context */}
      {step !== 3 && bookings.length > 0 && (
        <UpcomingSessionsCard bookings={bookings} className="mt-6" />
      )}

      {/* Success modal (overlays on top of the page) */}
      {step === 3 && bookingResult && (
        <BookingSuccess booking={bookingResult} onReset={handleReset} />
      )}
    </BookingShell>
  );
}

export default function BookSessionPage() {
  return (
    <Suspense fallback={
      <section
        className="fixed inset-0 z-[55] flex items-center justify-center"
        style={{ background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)' }}
      >
        <div className="animate-spin h-8 w-8 border-2 border-white/30 border-t-white rounded-full" />
      </section>
    }>
      <BookSessionContent />
    </Suspense>
  );
}
