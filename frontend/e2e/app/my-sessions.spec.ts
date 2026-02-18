import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('My Programs Page', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/my-programs');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user sees My Programs heading', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/my-programs');
    await expect(page.getByText('Mis Programas')).toBeVisible();
  });

  test('sidebar link navigates to my-programs', async ({ page }) => {
    await loginAsTestUser(page);
    await page.locator('aside').getByRole('link', { name: 'Mis Programas' }).click();
    await page.waitForURL('**/my-programs');
    await expect(page.getByRole('heading', { name: 'Mis Programas' })).toBeVisible();
  });

  test('shows empty state or subscription list', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/my-programs');
    // Wait for either subscriptions or the empty state to render (after API loads)
    await expect(
      page.getByText('Activo').or(page.getByText('No tienes programas aún'))
    ).toBeVisible({ timeout: 10_000 });
  });
});
