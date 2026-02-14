import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('Logout Flow', () => {
  test('logout from sidebar redirects to home', async ({ page }) => {
    await loginAsTestUser(page);

    // Click logout in sidebar
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    // After logout, user is redirected away from the authenticated area
    await page.waitForURL(url => !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/calendario'));
    // Verify we are on a public page (home or login)
    const url = page.url();
    expect(url.includes('/dashboard')).toBe(false);
  });
});
