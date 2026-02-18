import { test, expect } from '../fixtures';

const FAKE_TOKEN = 'fake-e2e-jwt-token-for-testing';

const FAKE_USER_COOKIE = JSON.stringify({
  id: 999,
  email: 'e2e@kore.com',
  first_name: 'Usuario',
  last_name: 'Prueba',
  phone: '',
  role: 'customer',
  name: 'Usuario Prueba',
});

test.describe('NoSessionsModal', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/google-captcha/site-key/', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    await page.route('**/api/auth/profile/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 999,
            email: 'e2e@kore.com',
            first_name: 'Usuario',
            last_name: 'Prueba',
            phone: '',
            role: 'customer',
          },
        }),
      }),
    );
    await page.route('**/api/bookings/upcoming-reminder/', (route) =>
      route.fulfill({ status: 204, body: '' }),
    );
    await page.route('**/api/bookings/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      }),
    );
    await page.route('**/api/trainers/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 1,
              user_id: 100,
              first_name: 'Germán',
              last_name: 'Franco',
              email: 'german@kore.com',
              specialty: 'Funcional',
              bio: 'Bio',
              location: 'KÓRE Studio',
              session_duration_minutes: 60,
            },
          ],
        }),
      }),
    );
    await page.route('**/api/availability-slots/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      }),
    );

    await page.context().addCookies([
      { name: 'kore_token', value: FAKE_TOKEN, domain: 'localhost', path: '/' },
      { name: 'kore_user', value: encodeURIComponent(FAKE_USER_COOKIE), domain: 'localhost', path: '/' },
    ]);
  });

  test('renders modal when subscription has no remaining sessions', async ({ page }) => {
    await page.route('**/api/subscriptions/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 10,
              id_display: 'SUB-010',
              package_name: 'Plan Básico',
              status: 'active',
              sessions_total: 4,
              sessions_used: 4,
              sessions_remaining: 0,
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              price: '150000.00',
            },
          ],
        }),
      }),
    );

    await page.goto('/book-session');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Sin sesiones disponibles')).toBeVisible();
    await expect(page.getByText('Has utilizado todas las sesiones de tu programa')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/dashboard');
    await expect(page.getByRole('link', { name: 'Ver programas' })).toHaveAttribute('href', '/subscription');
  });

  test('modal does not render during reschedule flow even with zero sessions', async ({ page }) => {
    await page.route('**/api/subscriptions/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 10,
              id_display: 'SUB-010',
              package_name: 'Plan Básico',
              status: 'active',
              sessions_total: 4,
              sessions_used: 4,
              sessions_remaining: 0,
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              price: '150000.00',
            },
          ],
        }),
      }),
    );

    await page.goto('/book-session?reschedule=123&subscription=10');
    await page.waitForLoadState('networkidle');

    const modalTitle = page.getByText('Sin sesiones disponibles');
    await expect(modalTitle).not.toBeVisible();
  });

  test('modal does not render when subscription has sessions remaining', async ({ page }) => {
    await page.route('**/api/subscriptions/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 10,
              id_display: 'SUB-010',
              package_name: 'Plan Básico',
              status: 'active',
              sessions_total: 4,
              sessions_used: 2,
              sessions_remaining: 2,
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              price: '150000.00',
            },
          ],
        }),
      }),
    );

    await page.goto('/book-session');
    await page.waitForLoadState('networkidle');

    const modalTitle = page.getByText('Sin sesiones disponibles');
    await expect(modalTitle).not.toBeVisible();
  });
});
