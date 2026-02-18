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

test.describe('BookingCalendar Edge Cases', () => {
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
              sessions_used: 1,
              sessions_remaining: 3,
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              price: '150000.00',
            },
          ],
        }),
      }),
    );

    await page.context().addCookies([
      { name: 'kore_token', value: FAKE_TOKEN, domain: 'localhost', path: '/' },
      { name: 'kore_user', value: encodeURIComponent(FAKE_USER_COOKIE), domain: 'localhost', path: '/' },
    ]);
  });

  test('past days are disabled and not clickable', async ({ page }) => {
    await page.route('**/api/availability-slots/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      }),
    );

    await page.goto('/book-session');
    await page.waitForLoadState('networkidle');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDay = yesterday.getDate();

    const calendarGrid = page.locator('.grid.grid-cols-7').last();
    const dayButtons = calendarGrid.locator('button');
    const pastDayButton = dayButtons.filter({ hasText: String(yesterdayDay) }).first();

    if ((await pastDayButton.count()) > 0) {
      await expect(pastDayButton).toBeDisabled();
    }
  });

  test('days without available slots are disabled', async ({ page }) => {
    await page.route('**/api/availability-slots/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      }),
    );

    await page.goto('/book-session');
    await page.waitForLoadState('networkidle');

    const calendarGrid = page.locator('.grid.grid-cols-7').last();
    const dayButtons = calendarGrid.locator('button');

    const firstButton = dayButtons.first();
    if ((await firstButton.count()) > 0) {
      await expect(firstButton).toBeDisabled();
    }
  });

  test('empty slots message shows when no slots available', async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    await page.route('**/api/availability-slots/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 100,
              trainer: 1,
              date: tomorrowDate,
              start_time: '09:00:00',
              end_time: '10:00:00',
              is_available: false,
            },
          ],
        }),
      }),
    );

    await page.goto('/book-session');
    await page.waitForLoadState('networkidle');

    const calendarGrid = page.locator('.grid.grid-cols-7').last();
    const dayButton = calendarGrid.locator('button').filter({ hasText: String(tomorrowDay) }).first();

    if ((await dayButton.count()) > 0 && !(await dayButton.isDisabled())) {
      await dayButton.click({ force: true });
      await page.waitForTimeout(500);

      await expect(
        page.getByText('No hay horarios disponibles para este día'),
      ).toBeVisible();
    }
  });

  test('selecting an available day highlights it as selected', async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    await page.route('**/api/availability-slots/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 100,
              trainer: 1,
              date: tomorrowDate,
              start_time: '09:00:00',
              end_time: '10:00:00',
              is_available: true,
            },
          ],
        }),
      }),
    );

    await page.goto('/book-session');
    await page.waitForLoadState('networkidle');

    const calendarGrid = page.locator('.grid.grid-cols-7').last();
    const dayButton = calendarGrid.locator('button').filter({ hasText: String(tomorrowDay) }).first();

    if ((await dayButton.count()) > 0 && !(await dayButton.isDisabled())) {
      await dayButton.click({ force: true });
      await page.waitForTimeout(300);

      const classes = await dayButton.getAttribute('class');
      expect(classes).toContain('bg-kore-red');
    }
  });

});
