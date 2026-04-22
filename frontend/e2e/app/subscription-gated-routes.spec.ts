import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Subscription Gated Routes', { tag: [...FlowTags.SUBSCRIPTION_GATED_ROUTES, RoleTags.USER] }, () => {

  const expiredSubscription = {
    id: 42,
    customer_email: 'e2e@kore.com',
    package: {
      id: 3,
      title: 'Plan Vencido',
      sessions_count: 4,
      session_duration_minutes: 60,
      price: '120000',
      currency: 'COP',
      validity_days: 30,
    },
    sessions_total: 4,
    sessions_used: 4,
    sessions_remaining: 0,
    status: 'expired',
    starts_at: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    expires_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    next_billing_date: null,
  };

  async function setupWithExpiredSubscription(page: import('@playwright/test').Page) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    // Override subscriptions AFTER setupDefaultApiMocks (LIFO — last-registered handler has priority)
    await page.route('**/api/subscriptions/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [expiredSubscription] }),
        });
      } else {
        await route.continue();
      }
    });
  }

  test('accessing /book-session with expired subscription redirects to /subscription', async ({ page }) => {
    await setupWithExpiredSubscription(page);
    await page.goto('/book-session');
    await page.waitForURL('**/subscription', { timeout: 15_000 });
  });

  test('accessing /my-diagnosis with expired subscription redirects to /subscription', async ({ page }) => {
    await setupWithExpiredSubscription(page);
    await page.goto('/my-diagnosis');
    await page.waitForURL('**/subscription', { timeout: 15_000 });
  });

  test('/subscription remains accessible with expired subscription', async ({ page }) => {
    await setupWithExpiredSubscription(page);
    await page.goto('/subscription');
    // Should stay on /subscription — no redirect
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/subscription/);
  });

  test('/profile remains accessible with expired subscription', async ({ page }) => {
    await setupWithExpiredSubscription(page);
    await page.goto('/profile');
    // Should stay on /profile — no redirect
    await expect(page.getByRole('heading', { level: 1, name: /Mi perfil/i })).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/profile/);
  });

  test('no redirect when user has no subscriptions at all', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    // setupDefaultApiMocks returns empty subscriptions — layout skips gating when list is empty
    await page.goto('/book-session');
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    // Should stay on /book-session (no expired sub → no redirect)
    await expect(page).toHaveURL(/\/book-session/);
  });
});
