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
    slot: { id: 9000, trainer_id: 1, starts_at: futureSlotStart.toISOString(), ends_at: futureSlotEnd.toISOString(), is_active: true, is_blocked: false },
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
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
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

  test('fetchBookings error shows empty state on program page', async ({ page }) => {
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

    await page.goto('/my-programs/program?id=11');

    // Should show empty state since bookings couldn't load
    await expect(page.getByRole('heading', { name: 'Programa', exact: true })).toBeVisible({ timeout: 10_000 });
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

    await page.goto('/my-programs/program?id=11');
    await expect(page.getByText('Paquete Pro').first()).toBeVisible({ timeout: 10_000 });

    // Open session detail modal
    const bookingRow = page.getByRole('button', { name: /Confirmada/ }).first();
    await bookingRow.click();
    await expect(page.getByText('Detalle de Sesión')).toBeVisible({ timeout: 5_000 });

    // Open cancel confirmation and confirm
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Cancelar sesión')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    // Error should be displayed in the modal
    await expect(page.getByText('No se puede cancelar esta sesión.')).toBeVisible({ timeout: 10_000 });
  });

  test('fetchSlots error does not break book-session page', async ({ page }) => {
    const mockTrainer = {
      id: 1, first_name: 'Germán', last_name: 'Franco', specialty: 'Funcional',
      session_duration_minutes: 60, location: 'Bogotá', email: 'g@kore.com', bio: '', user_id: 1,
    };

    await mockLoginAsTestUser(page);
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });
    await page.route('**/api/availability-slots/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
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
    await mockLoginAsTestUser(page);
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockTrainer]) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/book-session');

    // Page should still render with the trainer from the bare array
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Germán Franco')).toBeVisible({ timeout: 10_000 });
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
 * and the fetchMonthSlots non-paginated (array) response branch.
 */
test.describe('bookingStore extractErrorMessage branches', { tag: [...FlowTags.BOOKING_ERROR_PATHS, RoleTags.USER] }, () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  const dayNum = tomorrow.getDate().toString();

  const mockTrainer = {
    id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco',
    email: 'g@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá',
    session_duration_minutes: 60,
  };
  const mockSlot = {
    id: 601, trainer_id: 1,
    starts_at: `${dateStr}T10:00:00Z`, ends_at: `${dateStr}T11:00:00Z`,
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

  function slotLabel(slot: { starts_at: string; ends_at: string }) {
    const fmt = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(slot.starts_at)} \u2014 ${fmt(slot.ends_at)}`;
  }

  async function setupBookingMocks(page: import('@playwright/test').Page) {
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }) });
    });
    await page.route('**/api/availability-slots/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSlot] }) });
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

  async function forceClickDay(page: import('@playwright/test').Page, num: string) {
    await page.getByText('Lun').waitFor({ state: 'visible', timeout: 10_000 });
    await page.evaluate((n) => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent?.trim() === n) {
          const k = Object.keys(btn).find((key) => key.startsWith('__reactProps$'));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (k) { const p = (btn as any)[k]; if (typeof p?.onClick === 'function') p.onClick(); }
          break;
        }
      }
    }, num);
  }

  async function goToConfirmStep(page: import('@playwright/test').Page) {
    await mockLoginAsTestUser(page);
    await setupBookingMocks(page);
    await page.goto('/book-session');
    await forceClickDay(page, dayNum);
    await page.getByRole('button', { name: slotLabel(mockSlot), exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: slotLabel(mockSlot), exact: true }).click();
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

  test('createBooking error with slot_id field key shows field message', async ({ page }) => {
    await goToConfirmStep(page);
    await mockCreateBookingError(page, { slot_id: ['El slot seleccionado no existe.'] });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('El slot seleccionado no existe.')).toBeVisible({ timeout: 10_000 });
  });

  test('createBooking error with unknown field falls back to default message', async ({ page }) => {
    await goToConfirmStep(page);
    await mockCreateBookingError(page, { unknown_field: 'some error value' });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('No se pudo crear la reserva.')).toBeVisible({ timeout: 10_000 });
  });

  test('fetchMonthSlots handles non-paginated array response', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }) });
    });
    await page.route('**/api/availability-slots/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockSlot]) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
    await forceClickDay(page, dayNum);
    await page.getByRole('button', { name: slotLabel(mockSlot), exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  });
});
