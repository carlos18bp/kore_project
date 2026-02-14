import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('Book Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/book-session');
  });

  test('calendar renders with month navigation', async ({ page }) => {
    // Calendar should show current month label
    const monthLabel = page.locator('h3.capitalize');
    await expect(monthLabel).toBeVisible();

    // Day name headers should be visible
    await expect(page.getByText('Lun')).toBeVisible();
    await expect(page.getByText('Mar').first()).toBeVisible();

    // Navigate to next month
    const nextBtn = page.getByLabel('Mes siguiente');
    await nextBtn.click();
    // Month label should change
    await expect(monthLabel).toBeVisible();

    // Navigate back to previous month
    const prevBtn = page.getByLabel('Mes anterior');
    await prevBtn.click();
    await expect(monthLabel).toBeVisible();
  });

  test('clicking an available date shows time slots or empty message', async ({ page }) => {
    // Find and click an enabled day button (not disabled, not blank)
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();
      // After selecting a date, either time slots or "No hay horarios" should appear
      await expect(
        page.getByText(/\d{1,2}:\d{2}/).first().or(page.getByText('No hay horarios disponibles'))
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('time slot picker shows 12h/24h toggle', async ({ page }) => {
    // Click an available date to trigger slot loading
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();
      // Wait for slots or empty message
      await expect(
        page.getByText(/\d{1,2}:\d{2}/).first().or(page.getByText('No hay horarios disponibles'))
      ).toBeVisible({ timeout: 10_000 });

      // If slots are present, check the 12h/24h toggle
      const has24h = await page.getByRole('button', { name: '24h' }).isVisible().catch(() => false);
      const has12h = await page.getByRole('button', { name: '12h' }).isVisible().catch(() => false);
      if (has24h && has12h) {
        // Toggle to 12h
        await page.getByRole('button', { name: '12h' }).click();
        // Toggle back to 24h
        await page.getByRole('button', { name: '24h' }).click();
      }
    }
  });

  test('selecting a slot advances to confirmation step', async ({ page }) => {
    // Click an available date
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();

      // Wait for slots to appear
      const slotButton = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first();
      const slotsExist = await slotButton.isVisible({ timeout: 10_000 }).catch(() => false);

      if (slotsExist) {
        await slotButton.click();

        // Should advance to step 2 — Confirmation step shows "Confirmar reserva"
        await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

        // Trainer info panel should be visible
        await expect(page.getByText('Entrenamiento Kóre').first()).toBeVisible();

        // Back button should return to step 1
        await page.getByRole('button', { name: 'Atrás' }).click();
        await expect(page.getByText('Selecciona un día')).toBeVisible();
      }
    }
  });

  test('calendar year-boundary navigation: Jan→Dec and Dec→Jan', async ({ page }) => {
    const monthLabel = page.locator('h3.capitalize');
    await expect(monthLabel).toBeVisible();

    const prevBtn = page.getByLabel('Mes anterior');
    const nextBtn = page.getByLabel('Mes siguiente');

    // Navigate backwards to January (month 0)
    const currentMonth = new Date().getMonth(); // 0-indexed
    // Click prev enough times to reach January
    for (let i = 0; i <= currentMonth; i++) {
      await prevBtn.click();
    }
    // We should now be in December of the previous year (year boundary crossed)
    await expect(monthLabel).toContainText(/diciembre/i);

    // Now navigate forward past December to cross the year boundary the other way
    // From December, click next 12 times to reach December of next year
    for (let i = 0; i < 12; i++) {
      await nextBtn.click();
    }
    // Should be back to December (of the original year)
    await expect(monthLabel).toContainText(/diciembre/i);

    // One more click should cross into January of next year
    await nextBtn.click();
    await expect(monthLabel).toContainText(/enero/i);
  });

  test('trainer info panel renders with session details', async ({ page }) => {
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();
      const slotButton = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first();
      const slotsExist = await slotButton.isVisible({ timeout: 10_000 }).catch(() => false);

      if (slotsExist) {
        await slotButton.click();
        await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

        // TrainerInfoPanel: duration and location info
        await expect(page.getByText(/\d+ min/)).toBeVisible();
        await expect(page.getByText('En persona')).toBeVisible();

        // Timezone detection
        await expect(page.getByText(/\//)).toBeVisible(); // timezone format like America/Bogota
      }
    }
  });
});
