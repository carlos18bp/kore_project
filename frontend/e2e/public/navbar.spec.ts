import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Navbar — Desktop & Mobile', { tag: [...FlowTags.PUBLIC_NAVBAR, RoleTags.GUEST] }, () => {
  test('guest navigates to programs from navbar link', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-deep-link (página pública: la URL es una entrada legítima del sitio, no saltea navegación)
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);

    const nav = page.getByRole('navigation');
    const programsLink = nav.getByRole('link', { name: 'Programas' });
    await expect(programsLink).toBeVisible();

    await programsLink.click();
    await page.waitForURL(/\/programs$/);
    await expect(page).toHaveURL(/\/programs$/);
  });
});
