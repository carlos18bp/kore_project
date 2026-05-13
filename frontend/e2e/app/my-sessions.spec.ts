import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('My Programs Page', { tag: [...FlowTags.MY_PROGRAMS_LIST, RoleTags.USER] }, () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user sees Mi Suscripción heading', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/subscription');
    await expect(page.getByRole('heading', { name: 'Mi Suscripción' })).toBeVisible();
  });

  test('sidebar link navigates to subscription', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.locator('aside').getByRole('link', { name: 'Mi Suscripción' }).click();
    await page.waitForURL('**/subscription');
    await expect(page.getByRole('heading', { name: 'Mi Suscripción' })).toBeVisible();
  });

  test('shows the active subscription hero', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/subscription');
    await expect(
      page.getByText('Sin suscripción activa').or(page.getByRole('main').getByText('Tu plan vigente'))
    ).toBeVisible({ timeout: 10_000 });
  });
});
