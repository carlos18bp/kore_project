import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('Dashboard — Upcoming Session Reminder', () => {
  test('dashboard calls fetchUpcomingReminder on load', async ({ page }) => {
    // Track whether the upcoming-reminder API is called during dashboard load
    let reminderCalled = false;
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      reminderCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await loginAsTestUser(page);
    // Wait for the dashboard to settle and API calls to fire
    await page.waitForTimeout(3_000);
    expect(reminderCalled).toBe(true);
  });

  test('dashboard renders UpcomingSessionReminder when booking exists within 48h', async ({ page }) => {
    // Mock the upcoming-reminder endpoint to return a session within 48h
    const now = new Date();
    const futureSlotStart = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12h from now
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000); // +1h

    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          subscription_id_display: 11,
          status: 'confirmed',
          slot: {
            id: 9999,
            starts_at: futureSlotStart.toISOString(),
            ends_at: futureSlotEnd.toISOString(),
          },
          trainer: {
            first_name: 'Germán',
            last_name: 'Franco',
          },
        }),
      });
    });

    await loginAsTestUser(page);

    // Reminder modal should appear
    await expect(page.getByText('¡Tienes una sesión próxima!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Tu sesión está programada para')).toBeVisible();

    // "Cerrar" button dismisses the modal
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByText('¡Tienes una sesión próxima!')).not.toBeVisible();
  });

  test('reminder modal "Ver detalle" navigates to session detail', async ({ page }) => {
    const now = new Date();
    const futureSlotStart = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

    const mockBooking = {
      id: 999,
      subscription_id_display: 11,
      status: 'confirmed',
      slot: {
        id: 9999,
        starts_at: futureSlotStart.toISOString(),
        ends_at: futureSlotEnd.toISOString(),
        trainer_id: 1,
        is_active: true,
        is_blocked: false,
      },
      trainer: {
        id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco',
        email: 'g@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá',
        session_duration_minutes: 60,
      },
      package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
      customer_id: 1, notes: '', canceled_reason: '',
      created_at: now.toISOString(), updated_at: now.toISOString(),
    };

    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBooking),
      });
    });
    // Mock the bookings list endpoint needed when session detail page loads
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockBooking] }),
      });
    });

    await loginAsTestUser(page);
    await expect(page.getByText('¡Tienes una sesión próxima!')).toBeVisible({ timeout: 10_000 });

    // Click "Ver detalle"
    await page.getByRole('link', { name: 'Ver detalle' }).click();
    await page.waitForURL(/\/my-sessions\/program\/\d+\/session\/\d+/, { timeout: 15_000 });
  });

  test('reminder does NOT show when session is more than 48h away', async ({ page }) => {
    const now = new Date();
    // Session 72h in the future → hoursUntil > 48 → early return null
    const futureSlotStart = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          subscription_id_display: 11,
          status: 'confirmed',
          slot: {
            id: 9999,
            starts_at: futureSlotStart.toISOString(),
            ends_at: futureSlotEnd.toISOString(),
          },
          trainer: { first_name: 'Germán', last_name: 'Franco' },
        }),
      });
    });

    await loginAsTestUser(page);
    await page.waitForTimeout(2_000);
    await expect(page.getByText('¡Tienes una sesión próxima!')).not.toBeVisible();
  });

  test('reminder with null subscription_id_display navigates to /my-sessions', async ({ page }) => {
    const now = new Date();
    const futureSlotStart = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          subscription_id_display: null,
          status: 'confirmed',
          slot: {
            id: 9999,
            starts_at: futureSlotStart.toISOString(),
            ends_at: futureSlotEnd.toISOString(),
          },
          trainer: { first_name: 'Germán', last_name: 'Franco' },
        }),
      });
    });

    await loginAsTestUser(page);
    await expect(page.getByText('¡Tienes una sesión próxima!')).toBeVisible({ timeout: 10_000 });

    // "Ver detalle" link should point to /my-sessions (not /my-sessions/program/...)
    const detailLink = page.getByRole('link', { name: 'Ver detalle' });
    await expect(detailLink).toHaveAttribute('href', '/my-sessions');
  });

  test('dismissed reminder does NOT reappear when navigating back to dashboard', async ({ page }) => {
    const now = new Date();
    const futureSlotStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          subscription_id_display: 11,
          status: 'confirmed',
          slot: {
            id: 9999,
            starts_at: futureSlotStart.toISOString(),
            ends_at: futureSlotEnd.toISOString(),
          },
          trainer: { first_name: 'Germán', last_name: 'Franco' },
        }),
      });
    });

    await loginAsTestUser(page);
    await expect(page.getByText('¡Tienes una sesión próxima!')).toBeVisible({ timeout: 10_000 });

    // Dismiss the reminder
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByText('¡Tienes una sesión próxima!')).not.toBeVisible();

    // Navigate away and back to dashboard
    await page.goto('/book-session');
    await page.goto('/dashboard');
    await page.waitForTimeout(2_000);

    // Reminder should NOT reappear because sessionStorage persists within the tab
    await expect(page.getByText('¡Tienes una sesión próxima!')).not.toBeVisible();
  });

  test('reminder does NOT show when API returns no upcoming booking', async ({ page }) => {
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    await loginAsTestUser(page);

    // Wait a bit for any potential modal to appear
    await page.waitForTimeout(2_000);
    await expect(page.getByText('¡Tienes una sesión próxima!')).not.toBeVisible();
  });
});
