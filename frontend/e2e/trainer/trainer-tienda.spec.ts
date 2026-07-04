import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const PENDING = { count: 1, results: [{ id: 7, item_name: 'Camiseta', credits_spent: 50, status: 'pending', customer_name: 'Ana Ruiz' }] };

test.describe('Trainer — tienda', { tag: [...FlowTags.TRAINER_STORE_MANAGEMENT, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => { await injectTrainerAuthCookies(page); });

  test('shows pending redemptions and the catalog manager', async ({ page }) => {
    await page.route('**/api/trainer/store-items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Camiseta', price_credits: 50, item_type: 'producto', is_active: true }]) }));
    await page.route('**/api/trainer/store/redemptions/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }));
    await page.goto('/trainer/tienda');
    await expect(page.getByTestId('trainer-tienda')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Camiseta').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entregar' })).toBeVisible();
  });

  test('fulfills a redemption', async ({ page }) => {
    await page.route('**/api/trainer/store-items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/trainer/store/redemptions/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }));
    await page.route('**/api/trainer/store/redemptions/7/review/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 7, status: 'fulfilled' }) }));
    await page.goto('/trainer/tienda');
    await page.getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByText('Sin solicitudes pendientes.')).toBeVisible({ timeout: 10_000 });
  });
});
