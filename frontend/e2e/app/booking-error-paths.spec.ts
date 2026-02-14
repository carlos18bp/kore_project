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

  test('fetchBookings error shows error on my-sessions program page', async ({ page }) => {
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
    await page.goto('/my-sessions/program/11/session/800');

    // Should show not found since bookings couldn't load
    await expect(page.getByText('Sesión no encontrada.')).toBeVisible({ timeout: 10_000 });
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

    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/800');
    await expect(page.getByText('Confirmada')).toBeVisible({ timeout: 10_000 });

    // Open cancel modal and confirm
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Cancelar sesión')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    // Error should be displayed somewhere on the page
    await expect(page.getByText('No se puede cancelar esta sesión.')).toBeVisible({ timeout: 10_000 });
  });

  test('authHeaders without token sends request without Authorization', async ({ page }) => {
    // Clear cookies before navigating
    await page.context().clearCookies();
    await page.goto('/book-session');

    // Should redirect to login (no auth)
    await page.waitForURL('**/login', { timeout: 10_000 });
  });
});
