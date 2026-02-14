import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('My Sessions Page', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/my-sessions');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user sees My Sessions heading', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/my-sessions');
    await expect(page.getByText('Mis Programas')).toBeVisible();
  });

  test('sidebar link navigates to my-sessions', async ({ page }) => {
    await loginAsTestUser(page);
    await page.getByRole('link', { name: 'Mis Sesiones' }).click();
    await page.waitForURL('**/my-sessions');
    await expect(page.getByText('Mis Programas')).toBeVisible();
  });

  test('shows empty state or subscription list', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/my-sessions');
    // Wait for either subscriptions or the empty state to render (after API loads)
    await expect(
      page.getByText('Activo').or(page.getByText('No tienes programas aún'))
    ).toBeVisible({ timeout: 10_000 });
  });
});
