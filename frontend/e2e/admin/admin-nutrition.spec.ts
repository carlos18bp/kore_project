import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-nutrition
 * Admin nutrition add-on: edit the monthly price behind a confirmation dialog,
 * and flip includes_nutrition on a plan.
 */

const PRODUCT = {
  id: 1,
  name: 'Nutrición',
  price_cop: 30000,
  is_active: true,
  active_nutrition_subscriptions: 7,
};

const PACKAGE = {
  id: 101,
  title: 'Plan Base Personalizado',
  short_description: '',
  description: '',
  category: 'personalizado',
  sessions_count: 8,
  session_duration_minutes: 60,
  price: '300000',
  currency: 'COP',
  includes_nutrition: false,
  validity_days: 30,
  terms_and_conditions: '',
  is_active: true,
  order: 1,
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

test.describe('Admin Nutrition', { tag: [...FlowTags.ADMIN_NUTRITION, RoleTags.ADMIN] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
    await page.route('**/api/packages/**', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...PACKAGE, includes_nutrition: true }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [PACKAGE] }),
      });
    });
  });

  test('changing the price asks for confirmation and saves', async ({ page }) => {
    let patched: Record<string, unknown> | null = null;
    await page.route('**/api/admin/nutrition-product/', (route) => {
      if (route.request().method() === 'PATCH') {
        patched = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...PRODUCT, price_cop: 45000 }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT),
      });
    });

    await page.goto('/admin-platform/nutricion');
    await expect(page.getByTestId('nutrition-admin')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('nutrition-price-input')).toHaveValue('30000');

    await page.getByTestId('nutrition-price-input').fill('45000');
    await page.getByTestId('nutrition-save').click();

    // The impact of the change is stated before it is committed.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('7 suscripción(es) activa(s)')).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar cambio' }).click();
    await expect(dialog).not.toBeVisible();
    expect(patched).toEqual({ price_cop: 45000, is_active: true });
  });

  test('toggles includes_nutrition on a plan', async ({ page }) => {
    await page.route('**/api/admin/nutrition-product/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT),
      }),
    );

    await page.goto('/admin-platform/nutricion');
    await expect(page.getByTestId('nutrition-admin')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plan Base Personalizado')).toBeVisible();

    const toggle = page.getByTestId('nutrition-toggle-101').getByRole('switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('a rejected price save shows the nutrition error message', async ({ page }) => {
    await page.route('**/api/admin/nutrition-product/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT),
      }),
    );
    // Registered after the base route so the PATCH is answered with a 500 (LIFO).
    await mockApiError(page, '**/api/admin/nutrition-product/', 500, {}, { method: 'PATCH' });

    await page.goto('/admin-platform/nutricion');
    await expect(page.getByTestId('nutrition-admin')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('nutrition-price-input')).toHaveValue('30000');

    await page.getByTestId('nutrition-price-input').fill('45000');
    await page.getByTestId('nutrition-save').click();
    await page.getByRole('button', { name: 'Confirmar cambio' }).click();

    await expect(page.getByText('No se pudo guardar el precio de nutrición.')).toBeVisible();
  });
});
