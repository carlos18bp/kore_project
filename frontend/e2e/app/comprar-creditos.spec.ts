import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const PACKAGES = [{ id: 1, name: 'Impulso', credits: 100, price_cop: 20000 }];

test.describe('Comprar créditos', { tag: [...FlowTags.CUSTOMER_BUY_CREDITS, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/credits/packages/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PACKAGES) }));
    await page.route('**/api/credits/wallet/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balance: 100, pending_balance: 0, current_streak: 1, longest_streak: 1, last_active_date: '2026-07-07', next_milestone: null }) }));
  });

  test('lists credit packages', async ({ page }) => {
    await page.goto('/comprar-creditos');
    await expect(page.getByTestId('comprar-creditos')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Impulso')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Comprar' })).toBeVisible();
  });

  test('shows success on return from an approved payment', async ({ page }) => {
    await page.route('**/api/credits/purchases/CR-ok/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reference: 'CR-ok', status: 'approved', credits: 100 }) }));
    await page.goto('/comprar-creditos?ref=CR-ok');
    await expect(page.getByText(/¡Pago aprobado!/)).toBeVisible({ timeout: 15_000 });
  });
});
