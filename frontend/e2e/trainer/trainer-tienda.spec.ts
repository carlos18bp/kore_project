import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const ITEMS = [{ id: 1, name: 'Camiseta', description: '', price_credits: 50, item_type: 'producto', is_active: true, image_url: null }];
const PENDING = { count: 1, results: [{ id: 7, item_name: 'Camiseta', credits_spent: 50, status: 'pending', customer_name: 'Ana Ruiz', item_type: 'producto' }] };

test.describe('Trainer — tienda', { tag: [...FlowTags.TRAINER_STORE_MANAGEMENT, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => { await injectTrainerAuthCookies(page); });

  test('shows pending redemptions and the catalog manager', async ({ page }) => {
    await page.route('**/api/trainer/store-items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ITEMS) }));
    await page.route('**/api/trainer/store/redemptions/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }));
    await page.goto('/trainer/tienda');
    await expect(page.getByTestId('trainer-tienda')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Camiseta').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entregar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
  });

  test('fulfilling a producto requires uploading a photo', async ({ page }) => {
    await page.route('**/api/trainer/store-items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/trainer/store/redemptions/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }));
    await page.route('**/api/trainer/store/redemptions/7/review/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 7, status: 'fulfilled' }) }));
    await page.goto('/trainer/tienda');
    await page.getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByTestId('deliver-dialog')).toBeVisible();
    // Confirm without a photo → inline error, dialog stays
    await page.getByTestId('deliver-dialog').getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByText('La foto de entrega es obligatoria.')).toBeVisible();
    // Attach a photo and confirm
    await page.getByTestId('deliver-photo-input').setInputFiles({ name: 'd.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
    await page.getByTestId('deliver-dialog').getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByText('Sin solicitudes pendientes.')).toBeVisible({ timeout: 10_000 });
  });
});
