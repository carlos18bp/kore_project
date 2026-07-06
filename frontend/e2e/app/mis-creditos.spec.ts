import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const WALLET = {
  balance: 55, pending_balance: 15, current_streak: 3, longest_streak: 9,
  last_active_date: '2026-07-03', next_milestone: { days: 7, bonus: 50, remaining: 4 },
};
const TX = {
  count: 2,
  results: [
    { id: 1, action: 'workout_day', amount: 15, status: 'pending', description: 'Completaste tu entrenamiento del 2026-07-03', reference_type: 'daily_log', reference_id: '1', review_deadline: null, created_at: '2026-07-03T10:00:00Z' },
    { id: 2, action: 'no_show_penalty', amount: -40, status: 'confirmed', description: 'No asististe a tu sesión del 2026-07-02', reference_type: 'booking', reference_id: '2', review_deadline: null, created_at: '2026-07-02T23:57:00Z' },
  ],
};

test.describe('Mis créditos', { tag: [...FlowTags.CUSTOMER_CREDITS, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/credits/wallet/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WALLET) }));
    await page.route('**/api/credits/transactions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TX) }));
    await page.route('**/api/store/redemptions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  });

  test('shows balance, streak and history', async ({ page }) => {
    await page.goto('/mis-creditos');
    await expect(page.getByTestId('mis-creditos')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('55')).toBeVisible();
    await expect(page.getByText(/Faltan/)).toBeVisible();
    await expect(page.getByText('Completaste tu entrenamiento del 2026-07-03')).toBeVisible();
    await expect(page.getByText('No asististe a tu sesión del 2026-07-02')).toBeVisible();
  });

  test('shows the balance split (disponibles / por aprobar)', async ({ page }) => {
    await page.goto('/mis-creditos');
    await expect(page.getByText('Disponibles', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Por aprobar', { exact: true })).toBeVisible();
  });

  test('shows the delivery comprobante link for a fulfilled redemption', async ({ page }) => {
    await page.route('**/api/store/redemptions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 5, item: 1, item_name: 'Camiseta', item_type: 'producto', item_image_url: null, credits_spent: 50, status: 'fulfilled', trainer_note: '', delivery_photo_url: 'http://x/media/redemption_deliveries/d.png', created_at: '2026-07-03T10:00:00Z', resolved_at: '2026-07-04T10:00:00Z' },
    ]) }));
    await page.goto('/mis-creditos');
    await expect(page.getByRole('link', { name: 'Ver comprobante' })).toBeVisible({ timeout: 15_000 });
  });

  test('empty history shows the starter message', async ({ page }) => {
    await page.route('**/api/credits/transactions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
    await page.goto('/mis-creditos');
    await expect(page.getByText(/Aún no tienes movimientos/)).toBeVisible({ timeout: 15_000 });
  });
});
