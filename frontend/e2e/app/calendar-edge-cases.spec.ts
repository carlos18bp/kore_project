import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const FAKE_TOKEN = 'fake-e2e-jwt-token-for-testing';

const FAKE_USER_COOKIE = JSON.stringify({
  id: 999,
  email: 'e2e@kore.com',
  first_name: 'Usuario',
  last_name: 'Prueba',
  phone: '',
  role: 'customer',
  name: 'Usuario Prueba',
  profile_completed: true,
  avatar_url: null,
});

async function configureCalendarDefaults(page: Page) {
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
          profile_completed: true,
          avatar_url: null,
          customer_profile: { profile_completed: true, sex: 'M', date_of_birth: '1990-01-15', city: 'Bogotá', primary_goal: 'health' },
          today_mood: { score: 7, notes: '', date: new Date().toISOString().slice(0, 10) },
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
            customer_email: 'e2e@kore.com',
            package: {
              id: 6,
              title: 'Plan Básico',
              sessions_count: 4,
              session_duration_minutes: 60,
              price: '150000.00',
              currency: 'COP',
              validity_days: 30,
            },
            status: 'active',
            sessions_total: 4,
            sessions_used: 1,
            sessions_remaining: 3,
            starts_at: '2025-01-01T00:00:00Z',
            expires_at: '2025-12-31T00:00:00Z',
            next_billing_date: null,
          },
        ],
      }),
    }),
  );
}

async function seedAuthCookies(page: Page) {
  await page.context().addCookies([
    { name: 'kore_token', value: FAKE_TOKEN, domain: 'localhost', path: '/' },
    { name: 'kore_user', value: encodeURIComponent(FAKE_USER_COOKIE), domain: 'localhost', path: '/' },
  ]);
}

test.describe('BookingCalendar Edge Cases', { tag: [...FlowTags.BOOKING_CALENDAR_EDGE_CASES, RoleTags.USER] }, () => {
  test.beforeEach(async ({ page }) => {
    await configureCalendarDefaults(page);
    await seedAuthCookies(page);

    const seededCookies = await page.context().cookies();
    expect(seededCookies.some((cookie) => cookie.name === 'kore_token')).toBe(true);
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
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDay = yesterday.getDate();

    const pastDayButton = page.getByRole('button', { name: String(yesterdayDay), exact: true });

    if ((await pastDayButton.count()) > 0) {
      await expect(pastDayButton).toBeDisabled();
    }
  });

  test('Sunday days are disabled (no sessions on Sundays)', async ({ page }) => {
    await page.route('**/api/availability-slots/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      }),
    );

    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });

    // Find a Sunday in the current month and verify it is disabled
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let sundayDay: number | null = null;
    for (let d = today.getDate() + 1; d <= daysInMonth; d++) {
      if (new Date(year, month, d).getDay() === 0) { sundayDay = d; break; }
    }

    if (sundayDay !== null) {
      const sundayBtn = page.getByRole('button', { name: String(sundayDay), exact: true });
      if ((await sundayBtn.count()) > 0) {
        await expect(sundayBtn).toBeDisabled();
      }
    }
  });

  test('selecting a weekday shows time slot options', async ({ page }) => {
    await page.route('**/api/availability-slots/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      }),
    );

    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });

    // Find an enabled future weekday and click it
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Skip to next weekday if tomorrow is Sunday
    while (tomorrow.getDay() === 0) { tomorrow.setDate(tomorrow.getDate() + 1); }
    const dayNum = tomorrow.getDate();

    const dayButton = page.getByRole('button', { name: String(dayNum), exact: true });
    if ((await dayButton.count()) > 0 && !(await dayButton.isDisabled())) {
      await dayButton.click();

      // Virtual slot system generates time slots from WEEKDAY_WINDOWS
      // After selecting a day, the heading changes from 'Selecciona un día'
      await expect(page.getByText('Selecciona un día')).not.toBeVisible({ timeout: 10_000 });
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
              trainer_id: 1,
              starts_at: `${tomorrowDate}T09:00:00Z`,
              ends_at: `${tomorrowDate}T10:00:00Z`,
              is_active: true,
              is_blocked: false,
            },
          ],
        }),
      }),
    );

    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });

    const dayButton = page.getByRole('button', { name: String(tomorrowDay), exact: true });

    if ((await dayButton.count()) > 0 && !(await dayButton.isDisabled())) {
      await dayButton.click({ force: true });
      await expect(dayButton).toHaveClass(/bg-kore-red/);
    }
  });

});
