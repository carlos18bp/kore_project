import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const CATALOG = {
  items: [
    { id: 1, name: 'Camiseta KÓRE', description: 'Algodón premium', image_url: null, price_credits: 50, item_type: 'producto', is_active: true },
    { id: 2, name: 'Sesión extra', description: '', image_url: null, price_credits: 500, item_type: 'sesion_adicional', is_active: true },
  ],
  balance: 100, pending_balance: 15,
};

test.describe('Tienda', { tag: [...FlowTags.CUSTOMER_STORE, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/store/items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }));
  });

  test('shows catalog with balance and affordability', async ({ page }) => {
    await page.goto('/tienda');
    await expect(page.getByTestId('tienda')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('100 disponibles')).toBeVisible();
    await expect(page.getByText('Camiseta KÓRE')).toBeVisible();
    // affordable → "Canjear"; too expensive → "Sin saldo"
    await expect(page.getByRole('button', { name: 'Canjear' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sin saldo' })).toBeVisible();
  });

  test('redeems an affordable item via the confirm dialog', async ({ page }) => {
    await page.route('**/api/store/redemptions/', (r) => {
      if (r.request().method() === 'POST') return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 9, status: 'pending' }) });
      return r.fallback();
    });
    await page.goto('/tienda');
    await page.getByRole('button', { name: 'Canjear' }).first().click();
    await expect(page.getByText(/¿Canjear Camiseta KÓRE\?/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar canje' }).click();
    await expect(page.getByText(/¡Canje solicitado!/)).toBeVisible({ timeout: 10_000 });
  });
});
