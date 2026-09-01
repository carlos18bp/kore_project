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
    '/calendar',
    '/subscription',
    '/profile',
    '/my-diagnosis',
    '/my-nutrition',
    '/my-parq',
    '/my-physical-evaluation',
    '/my-posturometry',
    '/trainer/dashboard',
    '/trainer/clients',
    '/trainer/clients/client?id=1',
    '/trainer/clients/client/anthropometry?id=1',
    '/trainer/clients/client/nutrition?id=1',
    '/trainer/clients/client/parq?id=1',
    '/trainer/clients/client/physical-evaluation?id=1',
    '/trainer/clients/client/posturometry?id=1',
  ];

  for (const route of protectedRoutes) {
    test(`unauthenticated user visiting ${route} is redirected to /login`, { tag: ['@outcome:error'] }, async ({ page }) => {
      // quality: allow-no-interaction (unauthenticated redirect guard - no interactive element exists pre-auth)
      await page.goto(route);
      await page.waitForURL('**/login**', { timeout: 15_000 });
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('unauthenticated user visiting /checkout without package redirects to login or programs', { tag: ['@outcome:error'] }, async ({ page }) => {
    // quality: allow-no-interaction (unauthenticated redirect guard - no interactive element exists pre-auth)
    await page.goto('/checkout');
    await page.waitForURL(/\/(login|register|subscription|programs)/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(login|register|subscription|programs)/);
  });
});
