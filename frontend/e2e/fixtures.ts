import { test as base, expect, type Page } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

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
        },
      }),
    });
  });
}

/**
 * Inject auth cookies directly — for tests that only need an authenticated state
 * without going through the login form.
 */
export async function mockLoginAsTestUser(page: Page) {
  await mockLoginApi(page);
  await setupDefaultApiMocks(page);

  const baseURL = 'http://localhost:3000';
  await page.context().addCookies([
    { name: 'kore_token', value: FAKE_TOKEN, domain: 'localhost', path: '/' },
    { name: 'kore_user', value: encodeURIComponent(FAKE_USER_COOKIE), domain: 'localhost', path: '/' },
  ]);
  await page.goto(`${baseURL}/dashboard`);
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
}

/**
 * Custom Playwright fixture that automatically collects V8 code coverage
 * for every test. All E2E specs should import { test, expect } from this file.
 */
export const test = base.extend({
  autoTestFixture: [async ({ page }, use) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use('autoTestFixture');
    const jsCoverage = await page.coverage.stopJSCoverage();
    await addCoverageReport(jsCoverage, test.info());
  }, { scope: 'test', auto: true }],
});

export { expect };
