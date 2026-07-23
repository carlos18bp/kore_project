import type {
  AvailabilityMap,
  BookingData,
  PackageInfo,
  Subscription,
  Trainer,
} from '@/lib/stores/bookingStore';

/**
 * Typed builders for E2E mock payloads.
 *
 * These import the app's own types on purpose: if a serializer field is renamed
 * on the backend and the frontend type follows, `tsc --noEmit` breaks here
 * instead of the mocks silently drifting away from the real API.
 *
 * Every builder takes a partial override so specs express only what they care
 * about. Dates are derived from an explicit anchor (never `Date.now()` inside an
 * assertion path) so the payload and the calendar agree on the same local day.
 */

/** Local (not UTC) date key — mirrors `toDateKey` in app/(app)/book-session/page.tsx. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Next date strictly after `from` that is not a Sunday (the studio is closed). */
export function nextBookableDay(from: Date = new Date(), offsetDays = 1): Date {
  const day = new Date(from);
  day.setDate(day.getDate() + offsetDays);
  if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  return day;
}

export function makeTrainer(overrides: Partial<Trainer> = {}): Trainer {
  return {
    id: 1,
    user_id: 1,
    first_name: 'Germán',
    last_name: 'Franco',
    email: 'german@kore.com',
    specialty: 'Entrenamiento funcional',
    bio: '',
    location: 'KÓRE Studio — Calle 93 #11-26, Bogotá',
    session_duration_minutes: 60,
    ...overrides,
  };
}

export function makePackage(overrides: Partial<PackageInfo> = {}): PackageInfo {
  return {
    id: 1,
    title: 'Plan Kore',
    category: 'personalizado',
    sessions_count: 10,
    session_duration_minutes: 60,
    price: '300000',
    currency: 'COP',
    validity_days: 30,
    ...overrides,
  };
}

export function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  const now = Date.now();
  return {
    id: 1,
    customer_email: 'e2e@kore.com',
    package: makePackage(),
    sessions_total: 10,
    sessions_used: 3,
    sessions_remaining: 7,
    sessions_completed: 3,
    status: 'active',
    starts_at: new Date(now - 5 * 86_400_000).toISOString(),
    expires_at: new Date(now + 25 * 86_400_000).toISOString(),
    next_billing_date: null,
    is_recurring: false,
    billing_failed_at: null,
    ...overrides,
  };
}

export function makeBooking(overrides: Partial<BookingData> = {}): BookingData {
  const starts = nextBookableDay(new Date(), 2);
  starts.setHours(10, 0, 0, 0);
  const ends = new Date(starts.getTime() + 60 * 60_000);
  return {
    id: 900,
    customer_id: 999,
    package: makePackage(),
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    trainer: makeTrainer(),
    subscription_id_display: 1,
    status: 'confirmed',
    notes: '',
    canceled_reason: '',
    attendance_status: 'unset',
    attendance_confirmed_at: null,
    session_objective: '',
    session_notes_for_customer: '',
    program_day_exercises: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build an availability map keyed by LOCAL date, the shape the calendar reads.
 *
 * The booking page requests a 30-day window as soon as the trainer is known, so
 * a realistic map is what makes calendar days selectable. Returning `{}` leaves
 * every day disabled — which is what silently neutered the booking specs before.
 */
export function makeAvailability(
  options: { days?: number; hours?: number[]; from?: Date } = {},
): AvailabilityMap {
  const { days = 14, hours = [7, 10, 17], from = new Date() } = options;
  const map: AvailabilityMap = {};
  const cursor = new Date(from);

  for (let added = 0; added < days; ) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 0) continue; // studio closed on Sundays
    const key = toDateKey(cursor);
    map[key] = hours.map((hour) => {
      const slot = new Date(cursor);
      slot.setHours(hour, 0, 0, 0);
      return slot.toISOString();
    });
    added += 1;
  }

  return map;
}
