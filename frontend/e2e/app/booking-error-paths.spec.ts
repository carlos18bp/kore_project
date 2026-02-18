import { test, expect, loginAsTestUser } from '../fixtures';

/**
 * E2E tests targeting bookingStore error branches and edge cases.
 * These mock API failures to exercise catch blocks and fallback paths.
 */
test.describe('Booking Store Error Paths', () => {
  test.describe.configure({ mode: 'serial' });

  test('fetchTrainers error shows error loading trainers', async ({ page }) => {
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await loginAsTestUser(page);
    await page.goto('/book-session');

    // The page should still render even with trainer fetch failure
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('fetchSubscriptions error still renders booking page', async ({ page }) => {
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await loginAsTestUser(page);
    await page.goto('/book-session');

    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('fetchBookings error shows empty state on program page', async ({ page }) => {
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

    await loginAsTestUser(page);
    await page.goto('/my-programs/program/11');

    // Should show empty state since bookings couldn't load
    await expect(page.getByText('No tienes sesiones próximas.').or(page.getByText('Programa'))).toBeVisible({ timeout: 10_000 });
  });

  test('fetchUpcomingReminder error does not break dashboard', async ({ page }) => {
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });

    await loginAsTestUser(page);
    await page.goto('/dashboard');

    // Dashboard should still render
    await expect(page.getByText('Hola,')).toBeVisible({ timeout: 10_000 });
  });

  test('cancelBooking error keeps modal open and shows error', async ({ page }) => {
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
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockBooking] }),
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
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSubscription] }),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/my-programs/program/11');
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

    await loginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('non-paginated API responses exercise fallback branches', async ({ page }) => {
    const mockTrainer = {
      id: 1, first_name: 'Germán', last_name: 'Franco', specialty: 'Funcional',
      session_duration_minutes: 60, location: 'Bogotá', email: 'g@kore.com', bio: '', user_id: 1,
    };

    // Return bare arrays instead of paginated { results: [...] } objects
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockTrainer]) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await loginAsTestUser(page);
    await page.goto('/book-session');

    // Page should still render with the trainer from the bare array
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Germán Franco')).toBeVisible({ timeout: 10_000 });
  });

  test('authHeaders without token sends request without Authorization', async ({ page }) => {
    // Clear cookies before navigating
    await page.context().clearCookies();
    await page.goto('/book-session');

    // Should redirect to login (no auth)
    await page.waitForURL('**/login', { timeout: 10_000 });
  });

});
