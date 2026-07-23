import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { makeAvailability, nextBookableDay } from '../factories';
import { mockAvailability, mockNoAvailability } from '../helpers/availability';
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
          assigned_trainer: { id: 1, first_name: 'Germán', last_name: 'Franco', location: 'KÓRE Studio', session_duration_minutes: 60 },
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
  });

  test('every day in a fully past month is disabled', async ({ page }) => {
    await mockNoAvailability(page);

    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });

    // Paging back one month puts the whole grid in the past. Day 15 exists in
    // every month, so it is an unambiguous past day that must be disabled.
    await page.getByLabel('Mes anterior').click();
    await expect(page.getByRole('button', { name: '15', exact: true })).toBeDisabled();
  });

  test('a Sunday is disabled while its weekday neighbour is selectable', async ({ page }) => {
    // The studio is closed on Sundays, so the backend never publishes slots for
    // them. Build availability for every non-Sunday of next month and assert the
    // Sunday stays disabled — proving the calendar reflects real availability,
    // not a blanket disable.
    const nextMonthAnchor = new Date();
    nextMonthAnchor.setDate(1);
    nextMonthAnchor.setMonth(nextMonthAnchor.getMonth() + 1);
    const sunday = firstSundayOfMonth(nextMonthAnchor);
    const saturday = new Date(sunday);
    saturday.setDate(saturday.getDate() - 1);

    await mockAvailability(page, makeAvailability({ days: 40, from: new Date() }));

    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Mes siguiente').click();

    await expect(page.getByRole('button', { name: String(sunday.getDate()), exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: String(saturday.getDate()), exact: true })).toBeEnabled();
  });

  test('selecting a weekday shows its time slot options', async ({ page }) => {
    const day = nextBookableDay(new Date(), 1);
    await mockAvailability(page, makeAvailability({ from: new Date() }));

    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });
    await selectCurrentOrNextMonthDay(page, day);

    await expect(
      page.getByRole('main').getByRole('button', { name: /\d{1,2}:\d{2}/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('selecting an available day highlights it as selected', async ({ page }) => {
    const day = nextBookableDay(new Date(), 1);
    await mockAvailability(page, makeAvailability({ from: new Date() }));

    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });
    const dayButton = await selectCurrentOrNextMonthDay(page, day);

    await expect(dayButton).toHaveClass(/bg-kore-red/);
  });

});

/** First Sunday on or after the 1st of the given month. */
function firstSundayOfMonth(monthAnchor: Date): Date {
  const d = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  return d;
}

/** Click a day button, paging one month forward first when it is not this month. */
async function selectCurrentOrNextMonthDay(page: Page, date: Date) {
  if (date.getMonth() !== new Date().getMonth()) {
    await page.getByLabel('Mes siguiente').click();
  }
  const dayButton = page.getByRole('button', { name: String(date.getDate()), exact: true });
  await dayButton.click();
  return dayButton;
}
