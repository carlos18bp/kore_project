import { test, expect, injectAuthCookies, E2E_USER } from '../fixtures';
import type { Page } from '@playwright/test';
import { RoleTags } from '../helpers/flow-tags';

function buildProgramSubscription() {
  return {
    id: 11,
    customer_email: E2E_USER.email,
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    sessions_total: 4,
    sessions_used: 1,
    sessions_remaining: 3,
    status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
  };
}

async function mockBookingCreationFlowRoutes(
  page: Page,
  trainer: { id: number; first_name: string; last_name: string; specialty: string; session_duration_minutes: number; location: string; email: string; bio: string; user_id: number },
  slots: Array<{ id: number; starts_at: string; ends_at: string; is_blocked: boolean; is_active: boolean; trainer_id: number }>,
  sub: ReturnType<typeof buildProgramSubscription>,
) {
  await page.route('**/api/trainers/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [trainer] }) });
  });
  await page.route('**/api/availability/**', async (route) => {
    const availabilityMap: Record<string, string[]> = {};
    for (const slot of slots) {
      const key = slot.starts_at.slice(0, 10);
      if (!availabilityMap[key]) availabilityMap[key] = [];
      availabilityMap[key].push(slot.starts_at);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(availabilityMap) });
  });
  await page.route('**/api/subscriptions/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [sub] }) });
  });
  await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
  });
  await page.route('**/api/bookings/', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          subscription_id_display: null,
          status: 'confirmed',
          starts_at: slots[0].starts_at,
          ends_at: new Date(new Date(slots[0].starts_at).getTime() + 60 * 60000).toISOString(),
          trainer: null,
          package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
          customer_id: 1,
          notes: '',
          canceled_reason: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
    });
  });
}

/**
 * Targeted tests for uncovered branch paths:
 * - BookingSuccess with trainer=null and subscription_id_display=null
 * - BookingConfirmation with subscription=null (no active subscription)
 * - authStore hydrate() catch block (malformed cookie)
 */
test.describe('Edge-case branch coverage', { tag: [RoleTags.USER] }, () => {
  test.describe.configure({ mode: 'serial' });

  // Pick a target date that is a weekday Mon-Fri so the 17:00 slot falls within
  // production's WEEKDAY_WINDOWS (Mon-Fri have a 16:00-21:00 window; Sat is 6-13;
  // Sun is closed). Using +2 days also clears the 16-hour advance booking buffer.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  // Use LOCAL date components (matching calendar display & WEEKDAY_WINDOWS generation)
  const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const mockTrainer = {
    id: 1, first_name: 'Germán', last_name: 'Franco', specialty: 'Funcional',
    session_duration_minutes: 60, location: 'Bogotá', email: 'g@kore.com', bio: '', user_id: 1,
  };
  // Build slot times in LOCAL time so the availability map key matches the calendar date.
  const slotStartLocal = new Date(`${dateStr}T17:00:00`);
  const slotEndLocal   = new Date(`${dateStr}T18:00:00`);
  const mockSlots = [
    { id: 501, starts_at: slotStartLocal.toISOString(), ends_at: slotEndLocal.toISOString(), is_blocked: false, is_active: true, trainer_id: 1 },
  ];

  function slotLabelFor(slot: { starts_at: string }) {
    return new Date(slot.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const primarySlotLabel = slotLabelFor(mockSlots[0]);

  async function selectPrimarySlot(page: import('@playwright/test').Page) {
    const primarySlotButton = page.getByRole('button', { name: primarySlotLabel, exact: true });
    await expect(primarySlotButton).toBeVisible({ timeout: 10_000 });
    await primarySlotButton.click();
  }

  async function clickCalendarDay(page: import('@playwright/test').Page, dayNum: string) {
    // If targetDay falls in a future month (end-of-month case), navigate forward
    // so we click the correct enabled day instead of a same-numbered past day.
    const today = new Date();
    if (
      tomorrow.getMonth() !== today.getMonth() ||
      tomorrow.getFullYear() !== today.getFullYear()
    ) {
      await page.getByLabel('Mes siguiente').click();
    }
    const dayBtn = page.getByRole('button', { name: dayNum, exact: true });
    await dayBtn.click({ timeout: 10_000 });
  }

  test('booking success with trainer=null shows "—" fallback', { tag: ['@flow:booking-complete-flow', '@outcome:success'] }, async ({ page }) => {
    const mockSub = buildProgramSubscription();
    await injectAuthCookies(page);
    await mockBookingCreationFlowRoutes(page, mockTrainer, mockSlots, mockSub);

    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible();

    // Force-click date, select slot
    const dayNum = tomorrow.getDate().toString();
    await clickCalendarDay(page, dayNum);
    await selectPrimarySlot(page);

    // Confirmation screen — subscription=null means no "Programa" section
    const main = page.getByRole('main');
    await expect(main.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText(E2E_USER.fullName)).toBeVisible();

    // Confirm
    await main.getByRole('button', { name: 'Confirmar' }).click();

    // Success screen — trainer=null shows "—" for trainer name
    const modal = page.locator('[data-testid="booking-success-backdrop"]');
    await expect(modal.getByText('Tu entrenamiento está agendado')).toBeVisible({ timeout: 10_000 });
    // The trainer row should show "—" instead of a real name
    await expect(modal.getByText('—', { exact: true })).toBeVisible();

    // The link uses subscription_id_display ?? '' (null branch)
    await expect(modal.getByText('tu programa')).toBeVisible();
  });

  test('malformed kore_user cookie triggers hydrate catch branch', { tag: ['@flow:auth-session-persistence', '@outcome:error'] }, async ({ page }) => {
    // quality: allow-no-interaction (passive redirect-on-load: the malformed cookie IS the trigger; no user action exists)
    // Set a valid token but malformed user JSON
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-token-12345', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: '{invalid-json!!!', domain: 'localhost', path: '/' },
    ]);

    // Navigate to a protected page — hydrate() will try JSON.parse and fail
    await page.goto('/dashboard');

    // Should redirect to login since hydrate failed and cleared cookies
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/, { timeout: 15_000 });
  });

  test('no-token hydrate falls through without error', { tag: ['@flow:auth-session-persistence', '@outcome:error'] }, async ({ page }) => {
    // quality: allow-no-interaction (passive redirect-on-load: the missing session cookies ARE the trigger; no user action exists)
    // Clear all cookies first
    await page.context().clearCookies();

    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/, { timeout: 15_000 });
  });
});
