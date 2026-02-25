import { test, expect, loginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Logout Flow', { tag: [...FlowTags.AUTH_LOGOUT, RoleTags.USER] }, () => {
  test('logout from sidebar redirects to home', async ({ page }) => {
    await loginAsTestUser(page);

    // Click logout in sidebar
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    // After logout, user is redirected away from the authenticated area
    await page.waitForURL(url => !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/calendar'));
    // Verify we are on a public page (home or login)
    const url = page.url();
    expect(url.includes('/dashboard')).toBe(false);
  });
});
