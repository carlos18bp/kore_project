import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Comprar nutrición', { tag: [...FlowTags.CUSTOMER_BUY_NUTRITION, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => { await mockLoginAsTestUser(page); });

  test('shows the locked state and CTA without access', async ({ page }) => {
    await page.route('**/api/nutrition/access/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ has_nutrition_access: false, price_cop: 30000 }) }));
    await page.goto('/my-nutrition');
    await expect(page.getByTestId('nutrition-locked')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('nutrition-upgrade-cta')).toHaveText('Agrega nutrición a tu plan');
  });
});
