import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for authenticated route protection.
 * @flow:auth-protected-routes
 *
 * Verifies that all protected routes redirect unauthenticated users to /login.
 * Uses no auth cookies — all requests are anonymous.
 */
test.describe('Auth Protected Routes', { tag: [...FlowTags.AUTH_PROTECTED_ROUTES, RoleTags.GUEST] }, () => {

  const protectedRoutes = [
    '/dashboard',
    '/book-session',
    '/my-programs',
    '/subscription',
  ];

  for (const route of protectedRoutes) {
    test(`unauthenticated user visiting ${route} is redirected to /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL('**/login**', { timeout: 15_000 });
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('unauthenticated user visiting /checkout without package redirects to login or programs', async ({ page }) => {
    await page.goto('/checkout');
    // Checkout may redirect to login or to subscription/programs depending on implementation
    await page.waitForURL(/\/(login|register|subscription|programs)/, { timeout: 15_000 });
  });
});
