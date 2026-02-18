import { test, expect, loginAsTestUser } from '../fixtures';

/**
 * E2E tests for the booking reschedule flow.
 * Covers bookingStore.rescheduleBooking() (lines 283-301).
 * Uses mocked API responses to exercise success and error paths.
 * Session detail is now a modal opened from the program detail page.
 */
test.describe('Booking Reschedule Flow (mocked)', () => {
  test.describe.configure({ mode: 'serial' });

  const futureSlotStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

  const mockTrainer = {
    id: 1,
    user_id: 1,
    first_name: 'Germán',
    last_name: 'Franco',
    email: 'german@kore.com',
    specialty: 'Funcional',
    bio: '',
    location: 'Bogotá, Colombia',
    session_duration_minutes: 60,
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

  const mockBooking = {
    id: 800,
    customer_id: 1,
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    slot: { id: 9000, trainer_id: 1, starts_at: futureSlotStart.toISOString(), ends_at: futureSlotEnd.toISOString(), is_active: true, is_blocked: false },
    trainer: mockTrainer,
    subscription_id_display: 11,
    status: 'confirmed',
    notes: '',
    canceled_reason: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  function setupMocks(page: import('@playwright/test').Page, booking = mockBooking) {
    return Promise.all([
      page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
      }),
      page.route('**/api/bookings/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/upcoming-reminder')) {
          await route.fallback();
          return;
        }
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ count: 1, next: null, previous: null, results: [booking] }),
          });
          return;
        }
        await route.fallback();
      }),
      page.route('**/api/subscriptions/**', async (route) => {
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
      }),
      page.route('**/api/trainers/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }),
        });
      }),
    ]);
  }

  async function openSessionModal(page: import('@playwright/test').Page) {
    const bookingRow = page.getByRole('button', { name: /Confirmada/ }).first();
    await bookingRow.click();
    await expect(page.getByText('Detalle de Sesión')).toBeVisible({ timeout: 5_000 });
  }

  test('reschedule button navigates to book-session page', async ({ page }) => {
    await setupMocks(page);
    await loginAsTestUser(page);
    await page.goto('/my-programs/program/11');
    await expect(page.getByText('Paquete Pro').first()).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);

    await expect(page.locator('.fixed').getByText('Confirmada')).toBeVisible();
    await page.getByRole('button', { name: 'Reprogramar' }).click();
    await page.waitForURL(/\/book-session/, { timeout: 15_000 });
    await expect(page.getByText('Agenda tu sesión')).toBeVisible();
  });

  test('modal shows session details including trainer info', async ({ page }) => {
    await setupMocks(page);
    await loginAsTestUser(page);
    await page.goto('/my-programs/program/11');
    await expect(page.getByText('Paquete Pro').first()).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);

    const modal = page.locator('.fixed');
    await expect(modal.getByRole('button', { name: 'Reprogramar' })).toBeVisible();
    await expect(modal.getByText('Germán Franco')).toBeVisible();
    await expect(modal.getByText('Bogotá, Colombia')).toBeVisible();
  });

  test('confirmed booking within 24h disables reschedule', async ({ page }) => {
    const soonStart = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const soonEnd = new Date(soonStart.getTime() + 60 * 60 * 1000);
    const soonBooking = {
      ...mockBooking,
      slot: { ...mockBooking.slot, starts_at: soonStart.toISOString(), ends_at: soonEnd.toISOString() },
    };

    await setupMocks(page, soonBooking);
    await loginAsTestUser(page);
    await page.goto('/my-programs/program/11');
    await expect(page.getByText('Paquete Pro').first()).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);

    await expect(page.locator('.fixed').getByText('Confirmada')).toBeVisible();
    const reprogramarBtn = page.getByRole('button', { name: 'Reprogramar' });
    await expect(reprogramarBtn).toBeDisabled({ timeout: 5_000 });
    await expect(reprogramarBtn).toHaveAttribute('title', /No se puede reprogramar a menos de 24h/);
  });
});
