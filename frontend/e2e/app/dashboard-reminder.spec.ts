import { test, expect, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';
import type { Page } from '@playwright/test';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

function buildReminderBooking(hoursAhead: number) {
  const now = new Date();
  const futureSlotStart = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);
  return {
    id: 999,
    subscription_id_display: 11,
    status: 'confirmed',
    starts_at: futureSlotStart.toISOString(),
    ends_at: futureSlotEnd.toISOString(),
    trainer: {
      id: 1,
      user_id: 1,
      first_name: 'Germ\u00e1n',
      last_name: 'Franco',
      email: 'g@kore.com',
      specialty: 'Funcional',
      bio: '',
      location: 'Bogot\u00e1',
      session_duration_minutes: 60,
    },
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    customer_id: 1,
    notes: '',
    canceled_reason: '',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

async function mockReminderResponse(page: Page, payload: unknown) {
  await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

async function mockBookingsList(page: Page, booking: ReturnType<typeof buildReminderBooking>) {
  await page.route('**/api/bookings/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/upcoming-reminder')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [booking] }),
    });
  });
}

test.describe('Dashboard - Upcoming Session Reminder', { tag: [...FlowTags.DASHBOARD_REMINDER, RoleTags.USER] }, () => {
  test('dashboard calls fetchUpcomingReminder on load', async ({ page }) => {
    let reminderCalled = false;
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      reminderCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await loginAsTestUser(page);
    await expect.poll(() => reminderCalled).toBe(true);
    expect(reminderCalled).toBe(true);
  });

  test('dashboard renders UpcomingSessionReminder when booking exists within 48h', async ({ page }) => {
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
          starts_at: futureSlotStart.toISOString(),
          ends_at: futureSlotEnd.toISOString(),
          trainer: {
            first_name: 'Germ\u00e1n',
            last_name: 'Franco',
          },
        }),
      });
    });

    await loginAsTestUser(page);

    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Tu sesi\u00f3n est\u00e1 programada para/)).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).not.toBeVisible();
  });

  test('reminder modal Ver detalle navigates to subscription', async ({ page }) => {
    const mockBooking = buildReminderBooking(6);
    await setupDefaultApiMocks(page);
    await mockReminderResponse(page, mockBooking);
    await mockBookingsList(page, mockBooking);

    await loginAsTestUser(page);
    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: 'Ver detalle' }).click();
    await page.waitForURL(/\/subscription/, { timeout: 15_000 });
  });

  test('reminder does NOT show when session is more than 48h away', async ({ page }) => {
    const now = new Date();
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
          starts_at: futureSlotStart.toISOString(),
          ends_at: futureSlotEnd.toISOString(),
          trainer: { first_name: 'Germ\u00e1n', last_name: 'Franco' },
        }),
      });
    });

    await loginAsTestUser(page);
    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).not.toBeVisible();
  });

  test('reminder with null subscription_id_display Ver detalle points to subscription', async ({ page }) => {
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
          starts_at: futureSlotStart.toISOString(),
          ends_at: futureSlotEnd.toISOString(),
          trainer: { first_name: 'Germ\u00e1n', last_name: 'Franco' },
        }),
      });
    });

    await loginAsTestUser(page);
    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).toBeVisible({ timeout: 10_000 });

    const detailLink = page.getByRole('link', { name: 'Ver detalle' });
    await expect(detailLink).toHaveAttribute('href', '/subscription');
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
          starts_at: futureSlotStart.toISOString(),
          ends_at: futureSlotEnd.toISOString(),
          trainer: { first_name: 'Germ\u00e1n', last_name: 'Franco' },
        }),
      });
    });

    await loginAsTestUser(page);
    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).not.toBeVisible();

    await page.goto('/programs', { waitUntil: 'domcontentloaded' });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).not.toBeVisible();
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

    await expect(page.getByText(/Tienes una sesi\u00f3n pr\u00f3xima/)).not.toBeVisible();
  });
});
