import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Kore Brand Page', { tag: [...FlowTags.PUBLIC_BRAND, RoleTags.GUEST] }, () => {
  test('guest navigates to programs from brand CTA', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-deep-link (página pública: la URL es una entrada legítima del sitio, no saltea navegación)
    await page.goto('/kore-brand');
    await expect(page).toHaveURL(/\/kore-brand$/);

    const cta = page.getByRole('link', { name: 'Nuestros programas' });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL('/programs');
  });
});
