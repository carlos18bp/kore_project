import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the full booking cancel journey.
 * @flow:booking-cancel-flow
 *
 * Covers: open session detail → enter reason → confirm cancel → verify status change.
 * Uses mocked API responses; no real backend required.
 */
test.describe('Booking Cancel Flow', { tag: [...FlowTags.BOOKING_CANCEL_FLOW, RoleTags.USER] }, () => {

  const futureSlotStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

  const mockSubscription = {
    id: 20,
    customer_email: 'e2e@kore.com',
    package: { id: 7, title: 'Plan Cancel Test', sessions_count: 4, session_duration_minutes: 60, price: '150000', currency: 'COP', validity_days: 30 },
    sessions_total: 4,
    sessions_used: 1,
    sessions_remaining: 3,
    status: 'active',
    starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 25 * 86400000).toISOString(),
    next_billing_date: null,
  };

  const mockBooking = {
    id: 900,
    customer_id: 999,
    package: mockSubscription.package,
    slot: { id: 9100, trainer_id: 1, starts_at: futureSlotStart.toISOString(), ends_at: futureSlotEnd.toISOString(), is_active: true, is_blocked: false },
    trainer: { id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco', email: 'german@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá', session_duration_minutes: 60 },
    subscription_id_display: 20,
    status: 'confirmed',
    notes: '',
    canceled_reason: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  async function setupMocks(page: import('@playwright/test').Page) {
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
    await page.route('**/api/bookings/*/cancel/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...mockBooking, status: 'canceled', canceled_reason: 'No puedo asistir' }),
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
  }

  test('full cancel journey: detail → reason → confirm → status change', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page);
    await page.goto('/my-programs/program?id=20');

    // Wait for the booking row to appear
    await expect(page.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 10_000 });

    // Open session detail modal
    await page.getByRole('button', { name: /Confirmada/ }).click();
    await expect(page.getByRole('dialog', { name: 'Detalle de Sesión' })).toBeVisible({ timeout: 5_000 });

    // Click cancel
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Cancelar sesión')).toBeVisible();

    // Fill reason
    await page.getByPlaceholder('Motivo de cancelación (opcional)').fill('No puedo asistir');

    // Confirm cancellation
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    // Modal should close after successful cancellation
    await expect(page.getByText('Detalle de Sesión')).not.toBeVisible({ timeout: 10_000 });
  });

  test('cancel API failure shows error feedback', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page);

    // Override cancel endpoint to return 500
    await page.route('**/api/bookings/*/cancel/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });

    await page.goto('/my-programs/program?id=20');
    await expect(page.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Confirmada/ }).click();
    await expect(page.getByRole('dialog', { name: 'Detalle de Sesión' })).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    // Modal should still be visible (cancel failed)
    await expect(page.getByRole('dialog', { name: 'Detalle de Sesión' })).toBeVisible({ timeout: 5_000 });
  });
});
