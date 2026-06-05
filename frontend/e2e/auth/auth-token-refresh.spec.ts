import { test, expect, E2E_USER, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * Flow: auth-token-refresh — when an authenticated API call returns 401 because
 * the access token expired, the http.ts response interceptor transparently
 * refreshes via /api/auth/token/refresh/ and retries the original request. If
 * the refresh itself fails, it falls back to clearing auth cookies so the next
 * hydrate routes to /login.
 *
 * These tests drive the interceptor through the real hydrate revalidation path
 * (authStore.revalidateProfile → GET /auth/profile/ via the `api` instance).
 * Endpoint mocks are registered AFTER setupDefaultApiMocks so they win the
 * Playwright LIFO route resolution.
 */

const VALID_USER = JSON.stringify({
  id: 999,
  email: E2E_USER.email,
  first_name: E2E_USER.firstName,
  last_name: E2E_USER.lastName,
  phone: '',
  role: 'customer',
  name: E2E_USER.fullName,
  profile_completed: true,
  avatar_url: null,
  must_change_password: false,
});

const profileUser = {
  id: 999,
  email: E2E_USER.email,
  first_name: E2E_USER.firstName,
  last_name: E2E_USER.lastName,
  phone: '',
  role: 'customer',
  profile_completed: true,
  avatar_url: null,
  customer_profile: { profile_completed: true },
};

test.describe('Auth Token Refresh', { tag: [...FlowTags.AUTH_TOKEN_REFRESH, RoleTags.USER] }, () => {
  test('expired access token triggers a transparent refresh and retries the request', async ({ page }) => {
    await setupDefaultApiMocks(page);

    let refreshCalls = 0;
    await page.route('**/api/auth/token/refresh/', async (route) => {
      refreshCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access: 'fresh-access-token' }),
      });
    });

    // First /auth/profile/ call (with the expired token) 401s; after the
    // interceptor refreshes, the retried call must 200 so the session survives.
    let profileCalls = 0;
    await page.route('**/api/auth/profile/', async (route) => {
      profileCalls += 1;
      if (profileCalls === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Given token not valid for any token type' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: profileUser }),
        });
      }
    });

    await page.context().addCookies([
      { name: 'kore_token', value: 'expired-access-token', url: 'http://localhost:3000' },
      { name: 'kore_refresh', value: 'valid-refresh-token', url: 'http://localhost:3000' },
      { name: 'kore_user', value: encodeURIComponent(VALID_USER), url: 'http://localhost:3000' },
    ]);

    await page.goto('/dashboard');

    // Session survives the expiry: we stay on the dashboard rather than bounce to /login.
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(E2E_USER.firstName) }),
    ).toBeVisible({ timeout: 15_000 });

    // The interceptor refreshed and replayed the original request.
    await expect.poll(() => refreshCalls, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => profileCalls, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    // The refreshed access token replaced the expired one in the cookie.
    await expect
      .poll(
        async () =>
          (await page.context().cookies()).find((c) => c.name === 'kore_token')?.value,
        { timeout: 10_000 },
      )
      .toBe('fresh-access-token');

    expect(page.url()).toContain('/dashboard');
  });

  test('a failed refresh clears auth cookies and routes to /login', async ({ page }) => {
    await setupDefaultApiMocks(page);

    let refreshCalls = 0;
    await page.route('**/api/auth/token/refresh/', async (route) => {
      refreshCalls += 1;
      // Refresh token rejected — no recovery is possible.
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Token is invalid or expired' }),
      });
    });

    // Every /auth/profile/ call 401s; the refresh that the interceptor attempts
    // also fails, so the request must ultimately reject.
    await page.route('**/api/auth/profile/', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Given token not valid for any token type' }),
      });
    });

    await page.context().addCookies([
      { name: 'kore_token', value: 'expired-access-token', url: 'http://localhost:3000' },
      { name: 'kore_refresh', value: 'invalid-refresh-token', url: 'http://localhost:3000' },
      { name: 'kore_user', value: encodeURIComponent(VALID_USER), url: 'http://localhost:3000' },
    ]);

    await page.goto('/dashboard');

    // The session cannot be recovered, so we land on /login.
    await page.waitForURL('**/login', { timeout: 15_000 });

    // The interceptor did attempt the refresh before giving up.
    await expect.poll(() => refreshCalls, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    // The now-invalid auth cookies were cleared.
    const cookies = await page.context().cookies();
    const token = cookies.find((c) => c.name === 'kore_token');
    expect(!token || token.value === '').toBe(true);
  });
});
