import { test, expect, mockLoginAsTestUser, mockCaptchaSiteKey } from '../fixtures';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

function toDateKey(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * First future day (today+1 … today+5) whose next day falls in the same month,
 * so both calendar cells are visible in a single month view.
 */
function nextSameMonthDayPair(): { withSlots: Date; withoutSlots: Date } {
  for (let offset = 1; offset <= 5; offset += 1) {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    if (day.getMonth() === nextDay.getMonth()) return { withSlots: day, withoutSlots: nextDay };
  }
  throw new Error('unreachable: a 5-day window always contains a same-month pair');
}

async function goToCalendarMonth(page: import('@playwright/test').Page, target: Date) {
  await expect(page.getByText('Lun', { exact: true })).toBeVisible({ timeout: 10_000 });
  const now = new Date();
  if (target.getMonth() !== now.getMonth() || target.getFullYear() !== now.getFullYear()) {
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
  }
}

test.describe('Book Session Page', { tag: [...FlowTags.BOOKING_SESSION_PAGE, RoleTags.USER] }, () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/book-session');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user sees the booking page heading', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('booking page renders step indicator', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText(/Paso 1 de 2/)).toBeVisible({ timeout: 10_000 });
  });

  test('booking page shows calendar and placeholder text', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Selecciona una fecha en el calendario/)).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard "Agendar sesión" link navigates to book-session', async ({ page }) => {
    await mockLoginAsTestUser(page); // lands on /dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('link', { name: /Agendar sesión/ }).first().click();

    await expect(page).toHaveURL(/\/book-session/);
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('availability endpoint failure leaves the calendar without selectable days', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await mockApiError(page, '**/api/availability/**', 500);
    await page.goto('/book-session');

    // The page keeps its structure instead of crashing: heading, calendar and
    // the date placeholder stay visible. Step 1 has no dedicated error banner,
    // so the graceful degradation is a calendar with every day disabled.
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await goToCalendarMonth(page, tomorrow);
    await expect(
      page.getByRole('button', { name: String(tomorrow.getDate()), exact: true }),
    ).toBeDisabled({ timeout: 10_000 });
    await expect(page.getByText(/Selecciona una fecha en el calendario/)).toBeVisible();
  });

  test('day without published slots stays disabled while the day with slots is selectable', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const { withSlots, withoutSlots } = nextSameMonthDayPair();
    const slotIso = new Date(`${toDateKey(withSlots)}T10:00:00`).toISOString();
    await page.route('**/api/availability/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ [toDateKey(withSlots)]: [slotIso] }),
      });
    });
    await page.goto('/book-session');

    await goToCalendarMonth(page, withSlots);
    await expect(
      page.getByRole('button', { name: String(withSlots.getDate()), exact: true }),
    ).toBeEnabled({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: String(withoutSlots.getDate()), exact: true }),
    ).toBeDisabled();
  });
});
