import { type Page } from '@playwright/test';
import { mockCaptchaSiteKey } from '../fixtures';

/**
 * Admin authentication helper for E2E specs — analogous to the trainer helper
 * (`injectTrainerAuthCookies` in fixtures.ts) but scoped to the admin surface.
 *
 * ── Auth model note ────────────────────────────────────────────────────────
 * The Kore backend uses two distinct auth surfaces:
 *   • Django admin (`/admin/`)      → session cookie + CSRF token.
 *   • The `/api/` REST surface       → SimpleJWT (Bearer token).
 *
 * The `admin-platform/` route group is NOT the Django admin. It is part of the
 * Next.js SPA and consumes the JWT-backed `/api/` surface through the same
 * `useAuthStore` hydration used by customers and trainers. Its layout guard
 * (`app/admin-platform/layout.tsx`) reads `user.role === 'admin'` from the auth
 * store, which hydrates from the `kore_token` / `kore_user` cookies. There is
 * no session cookie or CSRF token involved in these SPA flows — so E2E auth for
 * admin-platform is established exactly like the trainer flows: by injecting the
 * JWT cookies and mocking `/api/auth/login/` + `/api/auth/profile/`.
 */

const FAKE_TOKEN = 'fake-e2e-jwt-token-for-testing';

/**
 * Dedicated E2E admin-user credentials.
 * No real backend user is required — all auth is mocked.
 */
export const E2E_ADMIN = {
  email: 'admin-e2e@kore.com',
  password: 'admin123456',
  firstName: 'Admin',
  lastName: 'Kore',
  fullName: 'Admin Kore',
};

const FAKE_ADMIN_COOKIE = JSON.stringify({
  id: 1,
  email: E2E_ADMIN.email,
  first_name: E2E_ADMIN.firstName,
  last_name: E2E_ADMIN.lastName,
  phone: '',
  role: 'admin',
  name: E2E_ADMIN.fullName,
  profile_completed: true,
  avatar_url: null,
  must_change_password: false,
});

/**
 * Mock the login API for an admin user (used by redirect-assertion tests).
 */
export async function mockAdminLoginApi(page: Page) {
  await page.route('**/api/auth/login/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tokens: { access: FAKE_TOKEN, refresh: 'fake-e2e-refresh-token' },
        user: {
          id: 1,
          email: E2E_ADMIN.email,
          first_name: E2E_ADMIN.firstName,
          last_name: E2E_ADMIN.lastName,
          phone: '',
          role: 'admin',
          profile_completed: true,
          avatar_url: null,
        },
      }),
    });
  });
}

/**
 * Mock the auth profile endpoint used by the admin layout hydration.
 */
export async function mockAdminAuthProfile(page: Page) {
  await page.route('**/api/auth/profile/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 1,
          email: E2E_ADMIN.email,
          first_name: E2E_ADMIN.firstName,
          last_name: E2E_ADMIN.lastName,
          phone: '',
          role: 'admin',
          profile_completed: true,
          avatar_url: null,
          must_change_password: false,
        },
      }),
    });
  });
}

/**
 * Inject admin auth cookies with minimal auth mocks (login API, captcha, admin profile).
 * The admin layout guard (`app/admin-platform/layout.tsx`) hydrates the auth store
 * from these cookies and requires `role === 'admin'`.
 */
export async function injectAdminAuthCookies(page: Page) {
  await mockAdminLoginApi(page);
  await mockCaptchaSiteKey(page);
  await mockAdminAuthProfile(page);
  await page.context().addCookies([
    { name: 'kore_token', value: FAKE_TOKEN, url: 'http://localhost:3000' },
    { name: 'kore_user', value: encodeURIComponent(FAKE_ADMIN_COOKIE), url: 'http://localhost:3000' },
  ]);
}

/**
 * Establish an admin-authenticated session. Admin specs navigate to the target
 * `/admin-platform/*` route themselves; the admin layout guards on role === 'admin'.
 */
export async function mockLoginAsAdmin(page: Page) {
  await injectAdminAuthCookies(page);
}
