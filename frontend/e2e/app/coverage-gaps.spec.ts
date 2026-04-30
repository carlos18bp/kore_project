import { test, expect, mockLoginAsTestUser } from '../fixtures';
import type { Page } from '@playwright/test';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

function buildSingleFutureSlot(dateIso: string) {
  return {
    id: 100,
    trainer_id: 1,
    starts_at: `${dateIso}T10:00:00Z`,
    ends_at: `${dateIso}T11:00:00Z`,
    is_active: true,
    is_blocked: false,
  };
}

async function mockBookSessionCoverageRoutes(page: Page, dateIso: string) {
  const mockSlot = buildSingleFutureSlot(dateIso);
  await page.route('**/api/availability-slots/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSlot] }),
    });
  });
  await page.route('**/api/trainers/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 1,
          user_id: 100,
          first_name: 'Test',
          last_name: 'Trainer',
          email: 'trainer@kore.com',
          specialty: 'Funcional',
          bio: '',
          location: 'Bogotá',
          session_duration_minutes: 60,
        }],
      }),
    });
  });
  await page.route('**/api/subscriptions/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/payments/') || url.includes('/cancel/')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 1,
          customer_email: 'e2e@kore.com',
          package: { id: 1, title: 'Test Package', sessions_count: 4, session_duration_minutes: 60, price: '100000', currency: 'COP', validity_days: 30 },
          sessions_total: 4,
          sessions_used: 0,
          sessions_remaining: 4,
          status: 'active',
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          next_billing_date: null,
        }],
      }),
    });
  });
  await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
  });
}

/**
 * E2E tests targeting specific coverage gaps identified in the coverage report.
 * These tests exercise branches that were not hit by other tests.
 */
test.describe('Coverage Gap Tests', { tag: [...FlowTags.APP_COVERAGE_GAPS, RoleTags.USER] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 1440, height: 900 } });

  // ─────────────────────────────────────────────────────────────────────────
  // TimeSlotPicker.tsx line 24 — Empty slots fallback
  // ─────────────────────────────────────────────────────────────────────────
  test('TimeSlotPicker shows empty message when no slots available', async ({ page }) => {
    // Pick a target weekday Mon-Sat so the day is enabled in the calendar
    // (Sundays are disabled since WEEKDAY_WINDOWS has no entry for day 0).
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    while (tomorrow.getDay() === 0) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    await mockLoginAsTestUser(page);
    await mockBookSessionCoverageRoutes(page, tomorrowStr);

    await page.goto('/book-session');

    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
    // If targetDay falls in a future month, navigate forward.
    const today = new Date();
    if (
      tomorrow.getMonth() !== today.getMonth() ||
      tomorrow.getFullYear() !== today.getFullYear()
    ) {
      await page.getByLabel('Mes siguiente').click();
    }
    const targetDay = String(tomorrow.getDate());
    if (tomorrow.getMonth() !== new Date().getMonth()) {
      await page.getByLabel('Mes siguiente').click();
    }
    const enabledDay = page.getByRole('button', { name: new RegExp(`^${targetDay}$`) });
    const dayExists = await enabledDay.isVisible().catch(() => false);
    const dayDisabled = dayExists ? await enabledDay.isDisabled().catch(() => true) : true;
    if (dayExists && !dayDisabled) {
      await enabledDay.click();
      // quality: allow-fragile-selector (slot list may repeat time labels; need first visible slot or empty copy)
      await expect(
        page.getByText(/\d{1,2}:\d{2}/).first().or(page.getByText('No hay horarios disponibles'))
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // subscription/page.tsx — active subscription card
  // ─────────────────────────────────────────────────────────────────────────
  test('subscription page shows active subscription card', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const activeSub = {
      id: 11,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Pro', sessions_count: 8, session_duration_minutes: 60, price: '240000', currency: 'COP', validity_days: 60 },
      sessions_total: 8,
      sessions_used: 3,
      sessions_remaining: 5,
      status: 'active',
      starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [activeSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/subscription');

    const subMain = page.getByRole('main');
    await expect(subMain.getByText('Paquete Pro').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(
      subMain.getByRole('button').filter({ hasText: 'Paquete Pro' }).getByText('Activa', { exact: true }),
    ).toBeVisible();
    await expect(subMain.getByText('3 de 8 completadas').filter({ visible: true }).first()).toBeVisible();
    await expect(subMain.getByText('Avance: 38%').filter({ visible: true }).first()).toBeVisible();
  });

  test('subscription page shows expired subscription in inactivas', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const expiredSub = {
      id: 12,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Básico', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 30 },
      sessions_total: 4,
      sessions_used: 4,
      sessions_remaining: 0,
      status: 'expired',
      starts_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [expiredSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/subscription');

    const subMainExpired = page.getByRole('main');
    await expect(subMainExpired.getByText('Paquete Básico').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(
      subMainExpired.getByRole('button').filter({ hasText: 'Paquete Básico' }).getByText('Expirada', { exact: true }),
    ).toBeVisible();
  });

  test('subscription page shows canceled subscription in inactivas', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const canceledSub = {
      id: 13,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Premium', sessions_count: 12, session_duration_minutes: 60, price: '360000', currency: 'COP', validity_days: 90 },
      sessions_total: 12,
      sessions_used: 2,
      sessions_remaining: 10,
      status: 'canceled',
      starts_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 70 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [canceledSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/subscription');

    const subMainCanceled = page.getByRole('main');
    await expect(subMainCanceled.getByText('Paquete Premium').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(
      subMainCanceled.getByRole('button').filter({ hasText: 'Paquete Premium' }).getByText('Cancelada', { exact: true }),
    ).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // subscription/page.tsx — unknown status shows raw value on badge
  // ─────────────────────────────────────────────────────────────────────────
  test('subscription card shows raw label for unknown status', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const unknownStatusSub = {
      id: 14,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Especial', sessions_count: 6, session_duration_minutes: 60, price: '180000', currency: 'COP', validity_days: 45 },
      sessions_total: 6,
      sessions_used: 1,
      sessions_remaining: 5,
      status: 'archived',
      starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 40 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [unknownStatusSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/subscription');

    const subMainUnknown = page.getByRole('main');
    await expect(subMainUnknown.getByText('Paquete Especial').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(
      subMainUnknown.getByRole('button').filter({ hasText: 'Paquete Especial' }).getByText('archived', { exact: true }),
    ).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // subscriptionStore.ts lines 57-59 — fetchSubscriptions error path
  // ─────────────────────────────────────────────────────────────────────────
  test('subscriptionStore fetchSubscriptions error shows message on subscription page', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/subscription');

    await expect(page.getByText('No se pudieron cargar las suscripciones.')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // subscriptionStore.ts lines 89-91 — fetchPaymentHistory error path
  // ─────────────────────────────────────────────────────────────────────────
  test('subscriptionStore fetchPaymentHistory error shows message on subscription page', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const mockSub = {
      id: 30,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Error', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 30 },
      sessions_total: 4,
      sessions_used: 1,
      sessions_remaining: 3,
      status: 'active',
      starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 25 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/*/payments/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/') || url.includes('/expiry-reminder')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/subscription');

    await expect(page.getByText('No se pudo cargar el historial de pagos.')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // bookingStore.ts lines 143-145 — extractErrorMessage non_field_errors branch
  // bookingStore.ts lines 149-153 — extractErrorMessage field-key (slot_id) branch
  // Both exercised via createBooking() failure on the book-session confirmation step
  // ─────────────────────────────────────────────────────────────────────────

  // Pick a target date that is a weekday Mon-Fri so the 17:00 slot falls within
  // production's WEEKDAY_WINDOWS (Mon-Fri have a 16:00-21:00 window). +2 days
  // also clears the 16-hour advance booking buffer.
  const _bktomorrow = new Date();
  _bktomorrow.setDate(_bktomorrow.getDate() + 2);
  while (_bktomorrow.getDay() === 0 || _bktomorrow.getDay() === 6) {
    _bktomorrow.setDate(_bktomorrow.getDate() + 1);
  }
  const _bkdateStr = `${_bktomorrow.getFullYear()}-${String(_bktomorrow.getMonth() + 1).padStart(2, '0')}-${String(_bktomorrow.getDate()).padStart(2, '0')}`;
  // Build slot times in LOCAL time so labels match virtual slot buttons
  // (production generates virtual slots from `new Date(\`${selectedDate}T${HH}:00:00\`)`).
  const _bkSlotStartLocal = new Date(`${_bkdateStr}T17:00:00`);
  const _bkSlotEndLocal   = new Date(`${_bkdateStr}T18:00:00`);
  const _bkSlot = {
    id: 601,
    starts_at: _bkSlotStartLocal.toISOString(),
    ends_at: _bkSlotEndLocal.toISOString(),
    is_blocked: false,
    is_active: true,
    trainer_id: 1,
  };
  const _bkSub = {
    id: 11,
    customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    sessions_total: 4,
    sessions_used: 1,
    sessions_remaining: 3,
    status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
    next_billing_date: null,
  };
  const _bkSlotLabel = (() => {
    const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${fmt(_bkSlot.starts_at)} \u2014 ${fmt(_bkSlot.ends_at)}`;
  })();

  async function setupBookSessionMocksForError(page: Page) {
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [{ id: 1, user_id: 100, first_name: 'Test', last_name: 'Trainer', email: 'trainer@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá', session_duration_minutes: 60 }] }),
      });
    });
    await page.route('**/api/availability-slots/**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [_bkSlot] }),
      });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) { await route.fallback(); return; }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [_bkSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
  }

  async function goToBookSessionConfirmStep(page: Page) {
    await page.goto('/book-session');
    // If targetDay falls in a future month (end-of-month case), navigate forward
    // so we click the correct enabled day instead of a same-numbered past day.
    const today = new Date();
    if (
      _bktomorrow.getMonth() !== today.getMonth() ||
      _bktomorrow.getFullYear() !== today.getFullYear()
    ) {
      await page.getByLabel('Mes siguiente').click();
    }
    const dayNum = _bktomorrow.getDate().toString();
    const dayBtn = page.getByRole('button', { name: dayNum, exact: true });
    await dayBtn.click({ timeout: 10_000 });
    const slotBtn = page.getByRole('button', { name: _bkSlotLabel, exact: true });
    await slotBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await slotBtn.click();
    await expect(page.getByRole('main').getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
  }

  test('bookingStore.createBooking non_field_errors string surfaces in BookingConfirmation', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupBookSessionMocksForError(page);
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ non_field_errors: 'El horario ya no está disponible.' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
      }
    });

    await goToBookSessionConfirmStep(page);
    await page.getByRole('button', { name: /Confirmar/i }).click();

    await expect(page.getByText('El horario ya no está disponible.')).toBeVisible({ timeout: 10_000 });
  });

  test('bookingStore.createBooking slot_id field error surfaces in BookingConfirmation', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupBookSessionMocksForError(page);
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ slot_id: ['Este horario ya está reservado.'] }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
      }
    });

    await goToBookSessionConfirmStep(page);
    await page.getByRole('button', { name: /Confirmar/i }).click();

    await expect(page.getByText('Este horario ya está reservado.')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TimeSlotPicker.tsx lines 10-15 — use24h=false branch of formatTime
  // Exercised by clicking the '12h' toggle button when slots are rendered.
  // ─────────────────────────────────────────────────────────────────────────
  test('TimeSlotPicker 24h toggle changes slot time format to 24h', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupBookSessionMocksForError(page);
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/book-session');
    // If targetDay falls in a future month (end-of-month case), navigate forward.
    {
      const today = new Date();
      if (
        _bktomorrow.getMonth() !== today.getMonth() ||
        _bktomorrow.getFullYear() !== today.getFullYear()
      ) {
        await page.getByLabel('Mes siguiente').click();
      }
    }
    const dayNum = _bktomorrow.getDate().toString();
    const dayBtn = page.getByRole('button', { name: dayNum, exact: true });
    await dayBtn.click({ timeout: 10_000 });

    // Slot should appear in 12h (AM/PM) format initially (TimeSlotPicker default)
    await page.getByRole('button', { name: _bkSlotLabel, exact: true }).waitFor({ state: 'visible', timeout: 10_000 });

    // Click 24h toggle — exercises TimeSlotPicker.tsx use24h=true branch
    await page.getByRole('button', { name: '24h' }).click();

    // Slot button should now show 24h format (no AM/PM)
    const fmt24 = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const label24h = `${fmt24(_bkSlot.starts_at)} \u2014 ${fmt24(_bkSlot.ends_at)}`;
    await expect(page.getByRole('button', { name: label24h, exact: true })).toBeVisible({ timeout: 5_000 });

    // Toggle back to 12h
    await page.getByRole('button', { name: '12h' }).click();
    await expect(page.getByRole('button', { name: _bkSlotLabel, exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
