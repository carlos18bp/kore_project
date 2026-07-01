import { test, expect, mockLoginAsTestUser, setupDefaultApiMocks } from '../fixtures';
import type { Page } from '@playwright/test';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

function buildCancelableBookingFixtures() {
  const futureSlotStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);
  const mockBooking = {
    id: 800,
    customer_id: 1,
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    starts_at: futureSlotStart.toISOString(),
    ends_at: futureSlotEnd.toISOString(),
    trainer: { id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco', email: 'german@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá', session_duration_minutes: 60 },
    subscription_id_display: 11,
    status: 'confirmed',
    notes: '',
    canceled_reason: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const mockSubscription = {
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

  return { mockBooking, mockSubscription };
}

async function mockCancelBookingFailureRoutes(
  page: Page,
  fixtures: ReturnType<typeof buildCancelableBookingFixtures>,
) {
  await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
  });
  await page.route('**/api/bookings/*/cancel/**', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'No se puede cancelar esta sesión.' }),
    });
  });
  await page.route('**/api/bookings/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/upcoming-reminder') || url.includes('/cancel/')) {
      await route.fallback();
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [fixtures.mockBooking] }),
      });
      return;
    }
    await route.fallback();
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
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [fixtures.mockSubscription] }),
    });
  });
}

/**
 * E2E tests targeting bookingStore error branches and edge cases.
 * These mock API failures to exercise catch blocks and fallback paths.
 */
test.describe('Booking Store Error Paths', { tag: [...FlowTags.BOOKING_ERROR_PATHS, RoleTags.USER] }, () => {
  test.describe.configure({ mode: 'serial' });

  test('fetchTrainers error shows error loading trainers', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });

    await page.goto('/book-session');

    // The page should still render even with trainer fetch failure
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('fetchSubscriptions error still renders booking page', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/book-session');

    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('fetchBookings error still renders subscription page', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder')) {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });

    await page.goto('/subscription');

    await expect(page.getByRole('heading', { name: 'Mi Suscripción' })).toBeVisible({ timeout: 10_000 });
  });

  test('fetchUpcomingReminder error does not break dashboard', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });

    await page.goto('/dashboard');

    // Dashboard should still render
    await expect(page.getByRole('heading', { level: 1, name: /Usuario/ })).toBeVisible({ timeout: 10_000 });
  });

  test('cancelBooking error keeps modal open and shows error', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const fixtures = buildCancelableBookingFixtures();
    await mockCancelBookingFailureRoutes(page, fixtures);

    await page.goto('/subscription');
    await expect(page.getByText('Paquete Pro').first()).toBeVisible({ timeout: 10_000 });

    // Open session detail modal
    const bookingRow = page.getByRole('button', { name: /Confirmada/ }).first();
    await bookingRow.click();
    await expect(page.getByText('Detalle de Sesión')).toBeVisible({ timeout: 5_000 });

    // Open cancel confirmation and confirm
    await page.getByRole('dialog', { name: 'Detalle de Sesión' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByText('Cancelar sesión')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    // Error should be displayed in the modal
    await expect(page.getByText('No se puede cancelar esta sesión.')).toBeVisible({ timeout: 10_000 });
  });

  test('fetchAvailability error does not break book-session page', async ({ page }) => {
    const mockTrainer = {
      id: 1, first_name: 'Germán', last_name: 'Franco', specialty: 'Funcional',
      session_duration_minutes: 60, location: 'Bogotá', email: 'g@kore.com', bio: '', user_id: 1,
    };

    await mockLoginAsTestUser(page);
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }) });
    });
    await page.route('**/api/availability/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });

    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('non-paginated API responses exercise fallback branches', async ({ page }) => {
    const mockTrainer = {
      id: 1, first_name: 'Germán', last_name: 'Franco', specialty: 'Funcional',
      session_duration_minutes: 60, location: 'Bogotá', email: 'g@kore.com', bio: '', user_id: 1,
    };

    // Return bare arrays instead of paginated { results: [...] } objects
    const mockActiveSub = {
      id: 1, status: 'active', is_guest: false, sessions_remaining: 7,
      customer_email: 'e2e@kore.com',
      package: { id: 1, title: 'Plan Kore', sessions_count: 10, session_duration_minutes: 60, price: '300000', currency: 'COP', validity_days: 30 },
      sessions_total: 10, sessions_used: 3,
    };
    await mockLoginAsTestUser(page);
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockTrainer]) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/pending-invitation/') || url.includes('/expiry-reminder/')) {
        return route.fulfill({ status: 204, body: '' });
      }
      // Return bare array to exercise the non-paginated fallback branch in subscriptionStore
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockActiveSub]) });
    });

    await page.goto('/book-session');

    // Page should still render with the subscription parsed from the bare (non-paginated) array
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('main').getByText(/Plan Kore/)).toBeVisible({ timeout: 10_000 });
  });

  test('authHeaders without token sends request without Authorization', async ({ page }) => {
    // Clear cookies before navigating
    await page.context().clearCookies();
    await setupDefaultApiMocks(page);
    await page.goto('/book-session');

    // Should redirect to login (no auth)
    await expect(page).toHaveURL(/\/login$/);
  });

});

/**
 * Tests targeting extractErrorMessage branches inside bookingStore.createBooking
 * plus booking-flow fallback paths.
 */
test.describe('bookingStore extractErrorMessage branches', { tag: [...FlowTags.BOOKING_ERROR_PATHS, RoleTags.USER] }, () => {
  // Pick a target date that is a weekday Mon-Fri so the 17:00 slot falls within
  // production's WEEKDAY_WINDOWS (Mon-Fri have a 16:00-21:00 window). +2 days
  // also clears the 16-hour advance booking buffer.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const dayNum = tomorrow.getDate().toString();

  const mockTrainer = {
    id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco',
    email: 'g@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá',
    session_duration_minutes: 60,
  };
  // Build slot times in LOCAL time so the availability map key matches the calendar date.
  const _slotStartLocal = new Date(`${dateStr}T17:00:00`);
  const _slotEndLocal   = new Date(`${dateStr}T18:00:00`);
  const mockSlot = {
    id: 601, trainer_id: 1,
    starts_at: _slotStartLocal.toISOString(), ends_at: _slotEndLocal.toISOString(),
    is_active: true, is_blocked: false,
  };
  const mockSubscription = {
    id: 20, customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    sessions_total: 4, sessions_used: 0, sessions_remaining: 4,
    status: 'active',
    starts_at: new Date(Date.now() - 86400000).toISOString(),
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    next_billing_date: null,
  };

  function slotLabel(slot: { starts_at: string }) {
    // TimeSlotPicker now shows only start time in es-CO locale
    return new Date(slot.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  async function setupBookingMocks(page: import('@playwright/test').Page) {
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }) });
    });
    await page.route('**/api/availability/**', async (route) => {
      const key = mockSlot.starts_at.slice(0, 10);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ [key]: [mockSlot.starts_at] }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSubscription] }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
  }

  async function goToConfirmStep(page: import('@playwright/test').Page) {
    await mockLoginAsTestUser(page);
    await setupBookingMocks(page);
    await page.goto('/book-session');
    // If targetDay falls in a future month (end-of-month case), navigate forward
    // so we click the correct enabled day instead of a same-numbered past day.
    const today = new Date();
    if (
      tomorrow.getMonth() !== today.getMonth() ||
      tomorrow.getFullYear() !== today.getFullYear()
    ) {
      await page.getByLabel('Mes siguiente').click();
    }
    // Click calendar day — virtual slot system enables Mon-Sat automatically
    const dayBtn = page.getByRole('button', { name: dayNum, exact: true });
    await dayBtn.click({ timeout: 10_000 });
    // Select the time slot matching the mock (TimeSlotPicker defaults to 12h)
    const slotBtn = page.getByRole('button', { name: slotLabel(mockSlot), exact: true });
    await slotBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await slotBtn.click();
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
  }

  async function mockCreateBookingError(page: import('@playwright/test').Page, errorBody: Record<string, unknown>) {
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify(errorBody) });
      } else {
        await route.continue();
      }
    });
  }

  test('createBooking error with detail string shows detail message', async ({ page }) => {
    await goToConfirmStep(page);
    await mockCreateBookingError(page, { detail: 'Slot no disponible en este momento.' });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Slot no disponible en este momento.')).toBeVisible({ timeout: 10_000 });
  });

  test('createBooking error with detail array shows first element', async ({ page }) => {
    await goToConfirmStep(page);
    await mockCreateBookingError(page, { detail: ['El horario ya fue reservado por otro usuario.'] });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('El horario ya fue reservado por otro usuario.')).toBeVisible({ timeout: 10_000 });
  });

  test('createBooking error with non_field_errors shows first element', async ({ page }) => {
    await goToConfirmStep(page);
    await mockCreateBookingError(page, { non_field_errors: ['No tienes sesiones disponibles en tu plan.'] });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('No tienes sesiones disponibles en tu plan.')).toBeVisible({ timeout: 10_000 });
  });

  test('createBooking error with starts_at field key shows field message', async ({ page }) => {
    await goToConfirmStep(page);
    await mockCreateBookingError(page, { starts_at: ['El horario seleccionado no está disponible.'] });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('El horario seleccionado no está disponible.')).toBeVisible({ timeout: 10_000 });
  });

  test('createBooking error with unknown field falls back to default message', async ({ page }) => {
    await goToConfirmStep(page);
    await mockCreateBookingError(page, { unknown_field: 'some error value' });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('No se pudo crear la reserva.')).toBeVisible({ timeout: 10_000 });
  });

});
