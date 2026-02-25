import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Navbar — Desktop & Mobile', { tag: [...FlowTags.PUBLIC_NAVBAR, RoleTags.GUEST] }, () => {
  test('guest navigates to programs from navbar link', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);

    const nav = page.getByRole('navigation');
    const programsLink = nav.getByRole('link', { name: 'Programas' });
    await expect(programsLink).toBeVisible();

    await programsLink.click();
    await expect(page).toHaveURL(/\/programs$/);
  });
});
