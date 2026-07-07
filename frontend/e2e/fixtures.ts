import { test as base, expect, type Page } from '@playwright/test';

/**
 * Dedicated E2E test-user credentials.
 * No real backend user is required — all auth is mocked.
 */
export const E2E_USER = {
  email: 'e2e@kore.com',
  password: 'e2e123456',
  firstName: 'Usuario',
  lastName: 'Prueba',
  fullName: 'Usuario Prueba',
};

const FAKE_TOKEN = 'fake-e2e-jwt-token-for-testing';

const FAKE_ASSIGNED_TRAINER = {
  id: 1,
  first_name: 'Germán Eduardo',
  last_name: 'Franco Moreno',
  location: 'KÓRE Studio — Calle 93 #11-26, Bogotá',
  session_duration_minutes: 60,
};

const FAKE_USER_COOKIE = JSON.stringify({
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
  assigned_trainer: FAKE_ASSIGNED_TRAINER,
});

/**
 * Mock the login API endpoint so it returns a fake token without hitting the backend.
 */
export async function mockLoginApi(page: Page) {
  await page.route('**/api/auth/login/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tokens: { access: FAKE_TOKEN, refresh: 'fake-e2e-refresh-token' },
        user: {
          id: 999,
          email: E2E_USER.email,
          first_name: E2E_USER.firstName,
          last_name: E2E_USER.lastName,
          phone: '',
          role: 'customer',
          profile_completed: true,
          avatar_url: null,
        },
      }),
    });
  });
}

/**
 * Inject auth cookies with minimal auth mocks (login API, captcha, profile) but
 * NO default API mocks. Use this when the test registers its own custom routes
 * before navigation — avoids LIFO conflicts with setupDefaultApiMocks routes.
 */
export async function injectAuthCookies(page: Page) {
  await mockLoginApi(page);
  await mockCaptchaSiteKey(page);
  await mockAuthProfile(page);
  await page.context().addCookies([
    { name: 'kore_token', value: FAKE_TOKEN, url: 'http://localhost:3000' },
    { name: 'kore_user', value: encodeURIComponent(FAKE_USER_COOKIE), url: 'http://localhost:3000' },
  ]);
}

/**
 * Inject auth cookies + default API mocks + navigate to /dashboard.
 * For tests that only need an authenticated state without custom route overrides.
 */
export async function mockLoginAsTestUser(page: Page) {
  await injectAuthCookies(page);
  await setupDefaultApiMocks(page);
  await page.goto('/dashboard');
}

/**
 * Shared login helper — fills the login form with mocked API and waits for redirect to /dashboard.
 */
export async function loginAsTestUser(page: Page) {
  await mockLoginApi(page);
  await mockCaptchaSiteKey(page);
  await mockAuthProfile(page);

  await page.goto('/login');
  await page.getByLabel(/Correo electrónico/i).fill(E2E_USER.email);
  await page.getByLabel(/Contraseña/i).fill(E2E_USER.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL('**/dashboard', { timeout: 60_000 });
}

/**
 * Mock the captcha site-key endpoint to return 404, disabling captcha in E2E tests.
 */
export async function mockCaptchaSiteKey(page: Page) {
  await page.route('**/api/google-captcha/site-key/', async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
}

/**
 * Mock the auth profile endpoint for hydration.
 */
export async function mockAuthProfile(page: Page) {
  await page.route('**/api/auth/profile/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 999,
          email: E2E_USER.email,
          first_name: E2E_USER.firstName,
          last_name: E2E_USER.lastName,
          phone: '',
          role: 'customer',
          profile_completed: true,
          avatar_url: null,
          assigned_trainer: FAKE_ASSIGNED_TRAINER,
          customer_profile: {
            profile_completed: true,
            sex: 'M',
            date_of_birth: '1990-01-15',
            city: 'Bogotá',
            primary_goal: 'health',
          },
          today_mood: { score: 7, notes: '', date: new Date().toISOString().slice(0, 10) },
        },
      }),
    });
  });
}

/**
 * Setup default API mocks for common endpoints so tests don't hit the real backend.
 * Individual tests can override specific routes after calling this.
 */
export async function setupDefaultApiMocks(page: Page, exclude: string[] = []) {
  await mockCaptchaSiteKey(page);
  await mockAuthProfile(page);

  // Nutrition access — granted by default so gated nutrition views don't show
  // the paywall lock. Specs testing the paywall override this route.
  await page.route('**/api/nutrition/access/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ has_nutrition_access: true, price_cop: 30000 }),
    });
  });

  // Subscriptions — one active subscription by default so gated views don't show locked state
  const defaultActiveSub = {
    id: 1,
    customer_email: 'e2e@kore.com',
    package: { id: 1, title: 'Plan Kore', sessions_count: 10, session_duration_minutes: 60, price: '300000', currency: 'COP', validity_days: 30, category: 'personalizado', is_active: true },
    sessions_total: 10,
    sessions_used: 3,
    sessions_remaining: 7,
    status: 'active',
    starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 25 * 86400000).toISOString(),
    next_billing_date: null,
    is_recurring: false,
    billing_failed_at: null,
    is_guest: false,
    guest_info: null,
  };
  await page.route('**/api/subscriptions/', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [defaultActiveSub] }),
      });
    } else {
      await route.continue();
    }
  });

  // Subscription expiry reminder — no reminder by default
  await page.route('**/api/subscriptions/expiry-reminder/**', async (route) => {
    await route.fulfill({ status: 204 });
  });

  // Pending duo invitation — none by default
  await page.route('**/api/subscriptions/pending-invitation/**', async (route) => {
    await route.fulfill({ status: 204 });
  });

  // Upcoming reminder — no upcoming booking
  await page.route('**/api/bookings/upcoming-reminder/', async (route) => {
    await route.fulfill({
      status: 204,
      contentType: 'application/json',
      body: JSON.stringify({ detail: null }),
    });
  });

  // Bookings list — empty
  await page.route('**/api/bookings/', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      });
    } else {
      await route.continue();
    }
  });

  // Trainers — one fake trainer
  await page.route('**/api/trainers/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [
        {
          id: 1,
          user_id: 100,
          first_name: 'Germán Eduardo',
          last_name: 'Franco Moreno',
          email: 'german.franco@kore.com',
          specialty: 'Entrenamiento funcional y bienestar',
          bio: 'Entrenador certificado.',
          location: 'KÓRE Studio — Calle 93 #11-26, Bogotá',
          session_duration_minutes: 60,
        },
      ]}),
    });
  });

  // Availability — empty by default
  await page.route('**/api/availability/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  // New dashboard store endpoints — empty by default
  if (!exclude.includes('my-anthropometry')) {
    await page.route('**/api/my-anthropometry/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }
  if (!exclude.includes('my-posturometry')) {
    await page.route('**/api/my-posturometry/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }
  if (!exclude.includes('my-physical-evaluation')) {
    await page.route('**/api/my-physical-evaluation/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }
  if (!exclude.includes('my-nutrition')) {
    await page.route('**/api/my-nutrition/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }
  if (!exclude.includes('my-parq')) {
    await page.route('**/api/my-parq/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }
  if (!exclude.includes('my-pending-assessments')) {
    await page.route('**/api/my-pending-assessments/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nutrition_due: false,
          parq_due: false,
          latest_anthropometry_at: null,
          latest_posturometry_at: null,
          latest_physical_eval_at: null,
          profile_incomplete: false,
          subscription_expiring: false,
          kore_index: null,
        }),
      });
    });
  }
}

/**
 * Dedicated E2E trainer-user credentials.
 * No real backend user is required — all auth is mocked.
 */
export const E2E_TRAINER = {
  email: 'trainer-e2e@kore.com',
  password: 'trainer123456',
  firstName: 'Germán',
  lastName: 'Franco',
  fullName: 'Germán Franco',
};

const FAKE_TRAINER_COOKIE = JSON.stringify({
  id: 100,
  email: E2E_TRAINER.email,
  first_name: E2E_TRAINER.firstName,
  last_name: E2E_TRAINER.lastName,
  phone: '',
  role: 'trainer',
  name: E2E_TRAINER.fullName,
  profile_completed: true,
  avatar_url: null,
});

/**
 * Mock login API for a trainer user (redirect assertion tests).
 */
export async function mockTrainerLoginApi(page: Page) {
  await page.route('**/api/auth/login/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tokens: { access: FAKE_TOKEN, refresh: 'fake-e2e-refresh-token' },
        user: {
          id: 100,
          email: E2E_TRAINER.email,
          first_name: E2E_TRAINER.firstName,
          last_name: E2E_TRAINER.lastName,
          phone: '',
          role: 'trainer',
          profile_completed: true,
          avatar_url: null,
        },
      }),
    });
  });
}

/**
 * Mock the auth profile endpoint for trainer hydration.
 */
export async function mockTrainerAuthProfile(page: Page) {
  await page.route('**/api/auth/profile/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 100,
          email: E2E_TRAINER.email,
          first_name: E2E_TRAINER.firstName,
          last_name: E2E_TRAINER.lastName,
          phone: '',
          role: 'trainer',
          profile_completed: true,
          avatar_url: null,
        },
      }),
    });
  });
}

/**
 * Inject trainer auth cookies with minimal auth mocks (login API, captcha, trainer profile).
 */
export async function injectTrainerAuthCookies(page: Page) {
  await mockTrainerLoginApi(page);
  await mockCaptchaSiteKey(page);
  await mockTrainerAuthProfile(page);
  await page.context().addCookies([
    { name: 'kore_token', value: FAKE_TOKEN, url: 'http://localhost:3000' },
    { name: 'kore_user', value: encodeURIComponent(FAKE_TRAINER_COOKIE), url: 'http://localhost:3000' },
  ]);
}

/**
 * Inject trainer auth cookies + navigate to /trainer/dashboard.
 * For tests that only need a trainer-authenticated state.
 */
export async function mockLoginAsTrainer(page: Page) {
  await injectTrainerAuthCookies(page);
}

/**
 * Admin auth helpers (E2E_ADMIN, injectAdminAuthCookies, mockLoginAsAdmin) live in
 * `helpers/admin-auth.ts` so the admin surface has a dedicated auth helper analogous
 * to the trainer one.
 */

/**
 * Catch-all fallback for any /api/** request not intercepted by a specific mock.
 * Prevents requests from reaching the Next.js proxy (which would fail with
 * ECONNREFUSED when no backend is running).
 * Registered first so that specific mocks (LIFO order) take priority.
 */
async function installApiFallback(page: Page) {
  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not found (E2E fallback)' }),
    });
  });
}

/**
 * Base Playwright fixture export for E2E specs.
 * Extends the default page fixture to install a catch-all API fallback.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await installApiFallback(page);
    await use(page);
  },
});

export { expect };
