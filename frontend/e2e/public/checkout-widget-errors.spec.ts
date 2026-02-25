import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Checkout Guest Flow', { tag: [...FlowTags.CHECKOUT_GUEST_REDIRECT, RoleTags.GUEST] }, () => {
  async function setupGuestCheckoutRoutes(page: import('@playwright/test').Page) {
    await page.route('**/api/google-captcha/site-key/', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    await page.route('**/api/auth/profile/', (route) =>
      route.fulfill({ status: 401, body: '' }),
    );
  }

  test('redirects guest user without registration token to register page', async ({ page }) => {
    await setupGuestCheckoutRoutes(page);
    await page.goto('/checkout?package=1');

    await page.waitForURL('**/register**', { timeout: 15000 });
    await expect(page).toHaveURL(/\/register\?package=1/);
  });

  test('preserves package parameter in redirect URL', async ({ page }) => {
    await setupGuestCheckoutRoutes(page);
    await page.goto('/checkout?package=5');

    await page.waitForURL('**/register**', { timeout: 15000 });
    await expect(page).toHaveURL(/\/register\?package=5/);
  });
});
