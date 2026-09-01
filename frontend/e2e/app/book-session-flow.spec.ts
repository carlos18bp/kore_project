import type { Page } from '@playwright/test';
import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { nextBookableDay } from '../factories';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * Booking flow driven entirely through the UI.
 *
 * The default availability fixture publishes real slots for the next 14
 * non-Sunday days, so calendar days are genuinely selectable — no attribute
 * tampering and no conditional guards: if a day cannot be clicked, that is a
 * regression and the test must fail.
 */

/** The calendar month header renders as "julio de 2026"; a sibling h3 shows the slot panel title. */
const MONTH_LABEL = { name: /\p{L}+ de \d{4}/u };

/** Click a calendar day the way a user would, paging to its month when needed. */
async function selectDay(page: Page, date: Date) {
  if (date.getMonth() !== new Date().getMonth()) {
    await page.getByLabel('Mes siguiente').click();
  }
  await page.getByRole('button', { name: String(date.getDate()), exact: true }).click();
}

/** Slot buttons render a localized 12-hour time, e.g. "10:00 a. m.". */
function slotButtons(page: Page) {
  return page.getByRole('button', { name: /\d{1,2}:\d{2}\s*[ap]\.\s*m\./i });
}

// quality: allow-fragile-selector (the mock publishes several equivalent slots; booking the first is a deliberate user choice)
function firstSlot(page: Page) {
  return slotButtons(page).first();
}

test.describe('Book Session Flow', { tag: [...FlowTags.BOOKING_SESSION_FLOW, RoleTags.USER] }, () => {
  const bookableDay = nextBookableDay(new Date(), 1);

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page).toHaveURL(/\/book-session/);
  });

  test('calendar shows weekday headers for the current month', async ({ page }) => {
    await expect(page.getByRole('heading', MONTH_LABEL)).toBeVisible();
    await expect(page.getByText('Lun')).toBeVisible();
    await expect(page.getByText('Mar').first()).toBeVisible();
  });

  test('month navigation moves forward and back to the starting month', async ({ page }) => {
    const monthLabel = page.getByRole('heading', MONTH_LABEL);
    const startingMonth = (await monthLabel.textContent())?.trim();

    await page.getByLabel('Mes siguiente').click();
    await expect(monthLabel).not.toHaveText(startingMonth!);

    await page.getByLabel('Mes anterior').click();
    await expect(monthLabel).toHaveText(startingMonth!);
  });

  test('selecting an available date lists that day time slots', async ({ page }) => {
    await selectDay(page, bookableDay);

    await expect(firstSlot(page)).toBeVisible({ timeout: 10_000 });
    await expect(slotButtons(page)).toHaveCount(3);
  });

  test('a day without published slots stays disabled', async ({ page }) => {
    // The fixture publishes no slots for today, so today is never selectable.
    const today = String(new Date().getDate());

    await expect(page.getByRole('button', { name: today, exact: true })).toBeDisabled();
  });

  test('selecting a slot advances to the confirmation step', async ({ page }) => {
    await selectDay(page, bookableDay);
    await firstSlot(page).click();

    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Entrenamiento Kóre').first()).toBeVisible();
  });

  test('going back from confirmation returns to the slot picker', async ({ page }) => {
    await selectDay(page, bookableDay);
    await firstSlot(page).click();
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Atrás' }).click();

    await expect(page.getByText('Confirmar reserva')).not.toBeVisible();
    await expect(firstSlot(page)).toBeVisible();
  });

  test('confirmation step shows the session duration and modality', async ({ page }) => {
    await selectDay(page, bookableDay);
    await firstSlot(page).click();
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/\d+ min/)).toBeVisible();
    await expect(page.getByText('En persona')).toBeVisible();
  });

  test('confirmation step shows the booking user identity fields', async ({ page }) => {
    await selectDay(page, bookableDay);
    await firstSlot(page).click();
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Nombre')).toBeVisible();
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
  });

  test('calendar year-boundary navigation: Jan→Dec and Dec→Jan', async ({ page }) => {
    const monthLabel = page.getByRole('heading', MONTH_LABEL);
    await expect(monthLabel).toBeVisible();

    const prevBtn = page.getByLabel('Mes anterior');
    const nextBtn = page.getByLabel('Mes siguiente');

    // Step back to January, then once more to cross into the previous December.
    const currentMonth = new Date().getMonth();
    for (let i = 0; i <= currentMonth; i++) {
      await prevBtn.click();
    }
    await expect(monthLabel).toContainText(/diciembre/i);

    for (let i = 0; i < 12; i++) {
      await nextBtn.click();
    }
    await expect(monthLabel).toContainText(/diciembre/i);

    await nextBtn.click();
    await expect(monthLabel).toContainText(/enero/i);
  });
});
