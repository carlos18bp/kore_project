import { test, expect } from '../fixtures';

test.describe('Checkout Guest Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/google-captcha/site-key/', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    await page.route('**/api/auth/profile/', (route) =>
      route.fulfill({ status: 401, body: '' }),
    );
  });

  test('redirects guest user without registration token to register page', async ({ page }) => {
    await page.goto('/checkout?package=1');

    await page.waitForURL('**/register**', { timeout: 15000 });

    expect(page.url()).toContain('/register');
    expect(page.url()).toContain('package=1');
  });

  test('preserves package parameter in redirect URL', async ({ page }) => {
    await page.goto('/checkout?package=5');

    await page.waitForURL('**/register**', { timeout: 15000 });

    expect(page.url()).toContain('/register');
    expect(page.url()).toContain('package=5');
  });
});
