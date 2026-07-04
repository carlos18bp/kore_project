import type { Page } from '@playwright/test';
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the trainer-driven booking flow (TrainerBookingDialog).
 *
 * The dialog is opened from the client-detail header ("Agendar sesión" button)
 * and from the "Reprogramar" action on an upcoming session row. It reuses the
 * customer BookingCalendar + TimeSlotPicker components, then submits to
 * POST /api/bookings/ (create) or POST /api/bookings/{id}/reschedule/.
 */

const pad = (n: number) => String(n).padStart(2, '0');

// Pick a target day 2 days out (skip Sunday) so it is within the 30-day
// availability window the dialog fetches on mount, and is clickable in the
// calendar (future, not past).
const targetDay = new Date();
targetDay.setDate(targetDay.getDate() + 2);
if (targetDay.getDay() === 0) targetDay.setDate(targetDay.getDate() + 1);
// LOCAL Y-M-D — the BookingCalendar compares against local date components,
// so the availability map must be keyed by the same local date.
const dateStr = `${targetDay.getFullYear()}-${pad(targetDay.getMonth() + 1)}-${pad(targetDay.getDate())}`;
const slotISO = new Date(`${dateStr}T10:00:00`).toISOString();
const slotLabel = new Date(slotISO).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
// availability map: { "YYYY-MM-DD": ["<ISO start>"] }
const availabilityMap: Record<string, string[]> = { [dateStr]: [slotISO] };

const fakeClient = {
  id: 1,
  first_name: 'María',
  last_name: 'López',
  email: 'maria@example.com',
  phone: '3009876543',
  avatar_url: null,
  profile: {
    sex: 'femenino',
    date_of_birth: '1992-03-20',
    city: 'Medellín',
    primary_goal: 'fat_loss',
  },
  subscription: {
    id: 11,
    package_id: 6,
    package_title: 'Plan Elite',
    package_price: '300000',
    package_currency: 'COP',
    sessions_total: 10,
    sessions_used: 4,
    sessions_remaining: 6,
    starts_at: '2025-10-01',
    expires_at: '2026-01-01',
    next_billing_date: null,
    is_recurring: false,
    status: 'active',
  },
  last_payment: { amount: '300000', currency: 'COP', created_at: '2025-10-01' },
  next_session: null,
  stats: { completed: 4, pending: 2, canceled: 1, total: 7 },
};

const fakeKPI = {
  behavioral: {
    training_adherence_7d: 0.8, nutrition_adherence_7d: 0.7, combined_adherence_7d: 0.75,
    streak_current: 4, streak_longest: 9, sessions_completed: 4, sessions_remaining: 6,
    last_activity_date: new Date().toISOString(), last_mood_score: 7,
  },
  clinical: {
    kore_score: 68, kore_color: 'yellow', kore_category: 'Bueno',
    bmi: 23.4, bmi_color: 'green', body_fat_pct: 18.2, bf_color: 'green',
    global_postural_index: 72, postural_color: 'yellow',
    physical_general_index: 65, physical_color: 'yellow',
    nutrition_habit_score: 70, nutrition_color: 'yellow', last_eval_dates: {},
  },
};

type SetupOpts = {
  client?: typeof fakeClient;
  sessions?: unknown[];
  kpiStatus?: number;
  availability?: Record<string, string[]>;
};

async function setupClientMocks(page: Page, opts: SetupOpts = {}) {
  const { client = fakeClient, sessions = [], kpiStatus = 404, availability = availabilityMap } = opts;

  await page.route('**/api/trainer/dashboard-stats/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_clients: 1, today_sessions: 0, upcoming_sessions: [] }) });
  });
  await page.route('**/api/trainer/my-clients/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/trainer/my-clients/1/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(client) });
  });
  await page.route('**/api/trainer/my-clients/1/sessions/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions) });
  });
  await page.route('**/api/trainer/my-clients/1/sessions-full/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions) });
  });
  await page.route('**/api/trainer/my-clients/1/kpi/', async (route) => {
    if (kpiStatus === 200) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeKPI) });
    } else {
      await route.fulfill({ status: 404, body: '' });
    }
  });
  await page.route('**/api/trainer/my-clients/1/alerts/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/availability/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(availability) });
  });
}

async function openCalendarDay(page: Page) {
  // Calendar renders once availability resolves; wait for the weekday header.
  await expect(page.getByText('Lun', { exact: true })).toBeVisible({ timeout: 10_000 });
  // Advance a month if the target day is not in the currently displayed month.
  const now = new Date();
  if (targetDay.getMonth() !== now.getMonth() || targetDay.getFullYear() !== now.getFullYear()) {
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
  }
  await page.getByRole('button', { name: String(targetDay.getDate()), exact: true }).click();
}

test.describe('Trainer Client Booking', { tag: [...FlowTags.TRAINER_CLIENT_BOOKING, RoleTags.TRAINER] }, () => {

  test('opens the booking dialog from the client header', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Agendar sesión' }).click();

    // Dialog-specific surface: the booking calendar renders inside the sheet.
    await expect(page.getByText('Lun', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('create booking: pick date + slot + confirm fires POST /api/bookings/', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientMocks(page);
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 900, status: 'confirmed', starts_at: slotISO, ends_at: slotISO }),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Agendar sesión' }).click();

    await openCalendarDay(page);
    await page.getByRole('button', { name: slotLabel, exact: true }).click();

    const bookingReq = page.waitForRequest(
      (r) => r.url().includes('/api/bookings/') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirmar y agendar' }).click();
    await bookingReq;

    await expect(page.getByText('¡Sesión agendada!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Listo' })).toBeVisible();
  });

  test('reschedule: pick a new slot fires POST /api/bookings/{id}/reschedule/', async ({ page }) => {
    const upcomingSession = {
      id: 700,
      status: 'confirmed',
      package_title: 'Plan Elite',
      starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      ends_at: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString(),
      notes: '',
      canceled_reason: '',
      session_notes_for_customer: '',
      created_at: new Date().toISOString(),
    };
    await injectTrainerAuthCookies(page);
    // KPI 200 so the Resumen hero + "Sesiones recientes" list (with the
    // Reprogramar action) renders.
    await setupClientMocks(page, { kpiStatus: 200, sessions: [upcomingSession] });
    await page.route('**/api/bookings/*/reschedule/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 700, status: 'confirmed', starts_at: slotISO, ends_at: slotISO }),
      });
    });
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Reprogramar' }).click();

    await openCalendarDay(page);
    await page.getByRole('button', { name: slotLabel, exact: true }).click();

    const reschedReq = page.waitForRequest(
      (r) => /\/api\/bookings\/\d+\/reschedule\//.test(r.url()) && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirmar reprogramación' }).click();
    await reschedReq;

    await expect(page.getByText('¡Sesión reprogramada!')).toBeVisible({ timeout: 10_000 });
  });

  test('shows the no-availability empty state when the trainer has no slots', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientMocks(page, { availability: {} });
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Agendar sesión' }).click();

    await expect(page.getByText('No hay disponibilidad en los próximos 30 días.')).toBeVisible({ timeout: 10_000 });
  });
});
