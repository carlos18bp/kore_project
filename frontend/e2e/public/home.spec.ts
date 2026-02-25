import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Home Page', { tag: [...FlowTags.PUBLIC_HOME, RoleTags.GUEST] }, () => {
  test('guest navigates to programs from hero CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Vuelve al centro' })).toBeVisible();
    const cta = page.getByRole('link', { name: 'Ver programas' }).first();
    await expect(cta).toBeVisible();

    await cta.click();
    await expect(page).toHaveURL('/programs');
  });
});
