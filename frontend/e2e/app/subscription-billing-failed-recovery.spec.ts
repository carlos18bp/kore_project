import { test, expect, injectAuthCookies, setupDefaultApiMocks, type Page } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the SubscriptionDashboardToast billing-failed branch.
 *
 * Triggered when the active subscription has `billing_failed_at` set after a
 * recurring billing attempt fails. The toast surfaces an "Actualizar pago"
 * link that navigates to /checkout?package=<id> for payment recovery.
 *
 * Strategy: inject auth cookies + default mocks, override /api/subscriptions/
 * with a payload that has billing_failed_at populated, navigate to /dashboard.
 */
test.describe('Subscription Billing Failed Recovery', { tag: [...FlowTags.SUBSCRIPTION_BILLING_FAILED_RECOVERY, RoleTags.USER] }, () => {

  const PACKAGE_ID = 6;

  function buildSubscription(overrides: Record<string, unknown> = {}) {
    return {
      id: 99,
      customer_email: 'e2e@kore.com',
      package: {
        id: PACKAGE_ID,
        title: 'Paquete Pro',
        sessions_count: 8,
        session_duration_minutes: 60,
        price: '240000',
        currency: 'COP',
        validity_days: 30,
      },
      sessions_total: 8,
      sessions_used: 2,
      sessions_remaining: 6,
      status: 'active',
      starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 25 * 86400000).toISOString(),
      next_billing_date: new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10),
      paused_at: null,
      is_recurring: true,
      billing_failed_at: new Date(Date.now() - 3600000).toISOString(),
      ...overrides,
    };
  }

  async function mockSubscriptions(page: Page, results: object[]) {
    await page.route('**/api/subscriptions/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: results.length, next: null, previous: null, results }),
        });
      } else {
        await route.continue();
      }
    });
  }

  test('shows billing failed toast when active subscription has billing_failed_at set', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await mockSubscriptions(page, [buildSubscription()]);

    await page.goto('/dashboard');

    await expect(page.getByText('No pudimos procesar tu pago')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Actualiza tu método de pago para mantener tu suscripción activa.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Actualizar pago' })).toBeVisible();
  });

  test('Actualizar pago link navigates to checkout with package id', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await mockSubscriptions(page, [buildSubscription()]);

    await page.goto('/dashboard');
    await expect(page.getByText('No pudimos procesar tu pago')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Actualizar pago' }).click();
    await page.waitForURL(new RegExp(`/checkout\\?package=${PACKAGE_ID}`), { timeout: 15_000 });
  });

  test('dismiss persists in sessionStorage and toast does not reappear on reload', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await mockSubscriptions(page, [buildSubscription()]);

    await page.goto('/dashboard');
    await expect(page.getByText('No pudimos procesar tu pago')).toBeVisible({ timeout: 15_000 });

    // Click "Más tarde" to dismiss
    await page.getByRole('button', { name: 'Más tarde' }).click();
    await expect(page.getByText('No pudimos procesar tu pago')).not.toBeVisible();

    // Verify sessionStorage was set
    const dismissedValue = await page.evaluate(() => sessionStorage.getItem('kore_dashboard_toast_dismissed'));
    expect(dismissedValue).toBe('billing_failed');

    // Reload the page — toast should NOT reappear because the dismissal persists
    await page.reload();
    await expect(page.getByText('No pudimos procesar tu pago')).not.toBeVisible({ timeout: 5_000 });
  });

  test('does NOT show toast when subscription has no billing_failed_at', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await mockSubscriptions(page, [buildSubscription({ billing_failed_at: null })]);

    await page.goto('/dashboard');
    // Wait briefly for the dashboard to settle
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No pudimos procesar tu pago')).not.toBeVisible();
  });

  test('does NOT show toast when subscription is not active (cancelled)', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await mockSubscriptions(page, [buildSubscription({ status: 'canceled' })]);

    await page.goto('/dashboard');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No pudimos procesar tu pago')).not.toBeVisible();
  });
});
