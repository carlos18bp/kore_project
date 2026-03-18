import { test, expect, injectAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for subscription cancellation flow.
 * @flow:subscription-cancel-flow
 *
 * Covers: view active subscription → attempt cancel → verify UI state.
 * Note: Cancel button is currently disabled in the UI. These tests verify
 * the disabled state and guard against future enablement regressions.
 */
test.describe('Subscription Cancel Flow', { tag: [...FlowTags.SUBSCRIPTION_CANCEL_FLOW, RoleTags.USER] }, () => {

  const mockSubscription: {
    id: number;
    customer_email: string;
    package: { id: number; title: string; sessions_count: number; session_duration_minutes: number; price: string; currency: string; validity_days: number };
    sessions_total: number;
    sessions_used: number;
    sessions_remaining: number;
    status: string;
    starts_at: string;
    expires_at: string;
    next_billing_date: string | null;
  } = {
    id: 25,
    customer_email: 'e2e@kore.com',
    package: { id: 8, title: 'Plan Cancel', sessions_count: 6, session_duration_minutes: 60, price: '180000', currency: 'COP', validity_days: 30 },
    sessions_total: 6,
    sessions_used: 2,
    sessions_remaining: 4,
    status: 'active',
    starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 25 * 86400000).toISOString(),
    next_billing_date: new Date(Date.now() + 25 * 86400000).toISOString(),
  };

  function setupMocks(page: import('@playwright/test').Page, sub: typeof mockSubscription | null) {
    return Promise.all([
      page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
      }),
      page.route('**/api/subscriptions/*/payments/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }),
      page.route('**/api/subscriptions/*/cancel/**', async (route) => {
        if (sub) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...sub, status: 'canceled' }),
          });
        } else {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        }
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
          body: JSON.stringify({
            count: sub ? 1 : 0,
            next: null,
            previous: null,
            results: sub ? [sub] : [],
          }),
        });
      }),
    ]);
  }

  test('active subscription shows cancel button as disabled', async ({ page }) => {
    await injectAuthCookies(page);
    await setupMocks(page, mockSubscription);
    await page.goto('/subscription');

    const cancelBtn = page.getByRole('button', { name: 'Cancelar suscripción' });
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await expect(cancelBtn).toBeDisabled();
  });

  test('disabled cancel button does not open confirmation dialog', async ({ page }) => {
    await injectAuthCookies(page);
    await setupMocks(page, mockSubscription);
    await page.goto('/subscription');

    const cancelBtn = page.getByRole('button', { name: 'Cancelar suscripción' });
    await expect(cancelBtn).toBeDisabled({ timeout: 10_000 });

    // Attempt force-click — confirmation should NOT appear
    await cancelBtn.click({ force: true }).catch(() => {});
    await expect(page.getByText('¿Seguro que deseas cancelar?')).not.toBeVisible();
  });

  test('expired subscription does not show cancel button', async ({ page }) => {
    const expiredSub = {
      ...mockSubscription,
      status: 'expired',
      sessions_used: 6,
      sessions_remaining: 0,
      next_billing_date: null,
    };
    await injectAuthCookies(page);
    await setupMocks(page, expiredSub);
    await page.goto('/subscription');

    await expect(page.getByText('Expirada', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Esta suscripción está inactiva')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar suscripción' })).not.toBeVisible();
  });

  test('canceled subscription shows Cancelada badge without cancel action', async ({ page }) => {
    const canceledSub = { ...mockSubscription, status: 'canceled' };
    await injectAuthCookies(page);
    await setupMocks(page, canceledSub);
    await page.goto('/subscription');

    await expect(page.getByText('Cancelada', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Cancelar suscripción' })).not.toBeVisible();
  });
});
