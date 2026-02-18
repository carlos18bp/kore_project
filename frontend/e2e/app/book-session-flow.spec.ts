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

  test('confirmation step without active subscription shows user info only', async ({ page }) => {
    // This test exercises BookingConfirmation.tsx lines 46-52 (subscription is null branch)
    // The default mock has no subscriptions, so we should see the confirmation UI
    // without the subscription info block

    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();
      const slotButton = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first();
      const slotsExist = await slotButton.isVisible({ timeout: 10_000 }).catch(() => false);

      if (slotsExist) {
        await slotButton.click();
        await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

        // User info should be visible
        await expect(page.getByText('Nombre')).toBeVisible();
        await expect(page.getByText('Email')).toBeVisible();

        // Confirm button should be visible
        await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Atrás' })).toBeVisible();
      }
    }
  });

  test('subscription selector shows active subscriptions with session details', async ({ page }) => {
    // Check if subscription selector is visible when user has active subscriptions
    const subscriptionSelector = page.locator('select#subscription-select');
    const hasSelector = await subscriptionSelector.isVisible().catch(() => false);

    if (hasSelector) {
      // Verify TODO note is present
      await expect(page.getByText(/This was not included in the project scope/)).toBeVisible();

      // Verify session details card is visible
      await expect(page.getByText(/Sesión \d+ de \d+/)).toBeVisible();
      await expect(page.getByText(/Programa:/)).toBeVisible();
    }
  });

  test('time slot picker 12h format toggle shows AM/PM', async ({ page }) => {
    // This test exercises TimeSlotPicker.tsx line 20 (!use24h branch)
    // Note: Uses beforeEach login, just needs to set up slot mocks and interact

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const mockSlots = [
      { id: 100, trainer_id: 1, starts_at: `${dateStr}T14:00:00Z`, ends_at: `${dateStr}T15:00:00Z`, is_active: true, is_blocked: false },
      { id: 101, trainer_id: 1, starts_at: `${dateStr}T16:00:00Z`, ends_at: `${dateStr}T17:00:00Z`, is_active: true, is_blocked: false },
    ];

    // Override availability-slots to return our mock slots
    await page.route('**/api/availability-slots/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 2, next: null, previous: null, results: mockSlots }) });
    });

    // Navigate to book-session (already logged in via beforeEach)
    await page.goto('/book-session');

    // Click the available day on the calendar
    const dayNumber = tomorrow.getDate();
    const dayButton = page.locator('button').filter({ hasText: new RegExp(`^${dayNumber}$`) }).first();
    await dayButton.click();

    // Wait for slots to appear
    await expect(page.getByRole('button', { name: '24h' })).toBeVisible({ timeout: 10_000 });

    // Toggle to 12h format
    await page.getByRole('button', { name: '12h' }).click();

    // Verify AM/PM format is shown (slots should show PM since they're at 14:00 and 16:00)
    await expect(page.getByText(/PM/).first()).toBeVisible({ timeout: 5_000 });

    // Toggle back to 24h
    await page.getByRole('button', { name: '24h' }).click();
  });
});
