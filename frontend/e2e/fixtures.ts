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
    { name: 'kore_token', value: FAKE_TOKEN, domain: 'localhost', path: '/' },
    { name: 'kore_user', value: encodeURIComponent(FAKE_USER_COOKIE), domain: 'localhost', path: '/' },
  ]);
}

/**
 * Inject auth cookies + default API mocks + navigate to /dashboard.
 * For tests that only need an authenticated state without custom route overrides.
 */
export async function mockLoginAsTestUser(page: Page) {
  await injectAuthCookies(page);
  await setupDefaultApiMocks(page);
  await page.goto('http://localhost:3000/dashboard');
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
export async function setupDefaultApiMocks(page: Page) {
  await mockCaptchaSiteKey(page);
  await mockAuthProfile(page);

  // Subscriptions — empty list
  await page.route('**/api/subscriptions/', async (route) => {
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

  // Subscription expiry reminder — no reminder by default
  await page.route('**/api/subscriptions/expiry-reminder/**', async (route) => {
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

  // Availability slots — empty by default
  await page.route('**/api/availability-slots/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
    });
  });

  // New dashboard store endpoints — empty by default
  await page.route('**/api/my-anthropometry/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/my-posturometry/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/my-physical-evaluation/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/my-nutrition/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/my-parq/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/my-pending-assessments/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kore_score: null, kore_color: 'green', kore_category: '', kore_message: '', components: {}, modules_available: 0, modules_total: 6 }),
    });
  });
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
  await mockLoginApi(page);
  await mockCaptchaSiteKey(page);
  await mockTrainerAuthProfile(page);
  await page.context().addCookies([
    { name: 'kore_token', value: FAKE_TOKEN, domain: 'localhost', path: '/' },
    { name: 'kore_user', value: encodeURIComponent(FAKE_TRAINER_COOKIE), domain: 'localhost', path: '/' },
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
