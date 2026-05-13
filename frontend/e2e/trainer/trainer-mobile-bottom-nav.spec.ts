import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the trainer mobile bottom navigation (TrainerMobileBottomNav).
 *
 * Hidden via xl:hidden on desktop, so all tests use a mobile viewport.
 * Trainer nav is simpler than the customer one: 3 tabs (Inicio, Clientes, Más)
 * with a "Más" sheet containing Soporte and Cerrar sesión.
 */
test.describe('Mobile Bottom Navigation (Trainer)', { tag: [...FlowTags.TRAINER_MOBILE_BOTTOM_NAV, RoleTags.TRAINER] }, () => {

  test.use({ viewport: { width: 390, height: 844 } });

  async function setupTrainerMocks(page: import('@playwright/test').Page) {
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_clients: 0, today_sessions: 0, upcoming_sessions: [] }),
      });
    });
    await page.route('**/api/trainer/my-clients/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  test.beforeEach(async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerMocks(page);
  });

  test('renders all three trainer bottom tabs on a mobile viewport', async ({ page }) => {
    await page.goto('/trainer/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await expect(nav.getByText('Inicio')).toBeVisible();
    await expect(nav.getByText('Clientes')).toBeVisible();
    await expect(nav.getByText('Más')).toBeVisible();
  });

  test('Clientes tab navigates to /trainer/clients', async ({ page }) => {
    await page.goto('/trainer/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('link', { name: /Clientes/ }).click();
    await page.waitForURL('**/trainer/clients', { timeout: 15_000 });
  });

  test('Inicio tab navigates back to /trainer/dashboard', async ({ page }) => {
    await page.goto('/trainer/clients');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('link', { name: /Inicio/ }).click();
    await page.waitForURL('**/trainer/dashboard', { timeout: 15_000 });
  });

  test('Más tab opens sheet with Soporte and Cerrar sesión', async ({ page }) => {
    await page.goto('/trainer/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });

    await nav.getByRole('button', { name: /Más/ }).click();
    await expect(page.getByText('Más opciones')).toBeVisible();
    await expect(page.getByRole('link', { name: /Soporte/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cerrar sesión/ })).toBeVisible();
  });

  test('Cerrar sesión from Más sheet logs trainer out', async ({ page }) => {
    await page.goto('/trainer/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });

    await nav.getByRole('button', { name: /Más/ }).click();
    await page.getByRole('button', { name: /Cerrar sesión/ }).click();

    // Logout calls router.push('/'); ProtectedRoute may race to /login
    await expect(page).toHaveURL(/\/(login)?$/, { timeout: 15_000 });
  });
});
