import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('My Sessions Flow — Program Detail & Session Detail', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/my-sessions');
    // Wait for subscriptions to load
    await expect(
      page.getByText('Activo').or(page.getByText('No tienes programas aún'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a subscription card navigates to program detail', async ({ page }) => {
    const hasPrograms = await page.getByText('Activo').isVisible().catch(() => false);
    if (!hasPrograms) {
      test.skip();
      return;
    }

    // Click the first subscription card
    await page.getByText('Activo').first().click();
    await page.waitForURL(/\/my-sessions\/program\/\d+/);

    // Breadcrumb should be visible
    await expect(page.getByText('Mis Sesiones').first()).toBeVisible();

    // Program detail card should show status and stats
    await expect(page.getByText('Restantes')).toBeVisible();
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.getByText('Vencimiento')).toBeVisible();
    await expect(page.getByText('Usadas')).toBeVisible();
  });

  test('program detail page renders upcoming/past tabs', async ({ page }) => {
    const hasPrograms = await page.getByText('Activo').isVisible().catch(() => false);
    if (!hasPrograms) {
      test.skip();
      return;
    }

    await page.getByText('Activo').first().click();
    await page.waitForURL(/\/my-sessions\/program\/\d+/);

    // Tab buttons
    await expect(page.getByRole('button', { name: 'Próximas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pasadas' })).toBeVisible();

    // Switch to "Pasadas" tab
    await page.getByRole('button', { name: 'Pasadas' }).click();
    // Either shows past sessions or empty message
    await expect(
      page.getByText('No hay sesiones pasadas.').or(page.locator('a[href*="/session/"]').first())
    ).toBeVisible({ timeout: 5_000 });

    // Switch back to "Próximas"
    await page.getByRole('button', { name: 'Próximas' }).click();
  });

  test('program detail shows empty state for upcoming when no bookings', async ({ page }) => {
    const hasPrograms = await page.getByText('Activo').isVisible().catch(() => false);
    if (!hasPrograms) {
      test.skip();
      return;
    }

    await page.getByText('Activo').first().click();
    await page.waitForURL(/\/my-sessions\/program\/\d+/);

    // If no upcoming bookings, should show empty message + CTA
    const isEmpty = await page.getByText('No tienes sesiones próximas.').isVisible({ timeout: 5_000 }).catch(() => false);
    if (isEmpty) {
      const link = page.getByRole('link', { name: 'Agendar sesión' });
      await expect(link).toBeVisible();
      const match = page.url().match(/\/my-sessions\/program\/(\d+)/);
      const subscriptionId = match?.[1];
      const href = await link.getAttribute('href');
      expect(subscriptionId).toBeTruthy();
      expect(href).toContain(`subscription=${subscriptionId}`);
    }
  });

  test('breadcrumb navigates back to my-sessions', async ({ page }) => {
    const hasPrograms = await page.getByText('Activo').isVisible().catch(() => false);
    if (!hasPrograms) {
      test.skip();
      return;
    }

    await page.getByText('Activo').first().click();
    await page.waitForURL(/\/my-sessions\/program\/\d+/);

    // Click breadcrumb link (inside main content, not sidebar)
    await page.getByRole('main').getByRole('link', { name: 'Mis Sesiones' }).click();
    await page.waitForURL('**/my-sessions');
    await expect(page.getByText('Mis Programas')).toBeVisible();
  });
});
