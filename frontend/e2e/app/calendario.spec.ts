import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('Calendario Page (redirect)', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/calendario');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user is redirected from /calendario to /book-session', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/calendario');
    await page.waitForURL('**/book-session');
    await expect(page).toHaveURL(/\/book-session/);
  });
});
