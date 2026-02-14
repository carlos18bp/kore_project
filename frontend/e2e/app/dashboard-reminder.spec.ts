import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('Dashboard — Upcoming Session Reminder', () => {
  test('dashboard calls fetchUpcomingReminder on load', async ({ page }) => {
    // Intercept the upcoming-reminder API call to verify it fires
    const reminderPromise = page.waitForResponse(
      (resp) => resp.url().includes('/bookings/upcoming-reminder') && resp.status() < 500,
      { timeout: 15_000 }
    ).catch(() => null);

    await loginAsTestUser(page);

    const response = await reminderPromise;
    // The API was called (may return 200 with data or 200 with null)
    expect(response).toBeTruthy();
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
    await expect(page.getByText('¡Tienes una sesión próxima!')).toBeVisible({ timeout: 10_000 });

    // Click "Ver detalle"
    await page.getByRole('link', { name: 'Ver detalle' }).click();
    await page.waitForURL(/\/my-sessions\/program\/\d+\/session\/\d+/);
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
