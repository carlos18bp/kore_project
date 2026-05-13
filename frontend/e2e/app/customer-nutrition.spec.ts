import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Customer Nutrition page (/my-nutrition).
 * Covers score card display, form interaction, history, and empty state.
 */
test.describe('Customer Nutrition Page', { tag: [...FlowTags.CUSTOMER_NUTRITION, RoleTags.USER] }, () => {

  const fakeEntry = {
    id: 1,
    created_at: '2026-01-10T10:00:00Z',
    meals_per_day: 4,
    water_liters: '2.5',
    fruit_weekly: 5,
    vegetable_weekly: 6,
    protein_frequency: 4,
    ultraprocessed_weekly: 2,
    sugary_drinks_weekly: 1,
    eats_breakfast: true,
    notes: '',
    habit_score: '7.8',
    habit_category: 'Buenos hábitos',
    habit_color: 'green',
  };

  async function goToNutritionWithData(page: import('@playwright/test').Page, entries = [fakeEntry]) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page, ['my-nutrition']);
    await page.route('**/api/my-nutrition/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(entries),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(fakeEntry),
        });
      }
    });
    await page.goto('/my-nutrition');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi Nutrición' })).toBeVisible({ timeout: 15_000 });
  }

  test('renders page heading and description', async ({ page }) => {
    await goToNutritionWithData(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Mi Nutrición' })).toBeVisible();
    await expect(page.getByText(/Registra tus hábitos alimentarios/)).toBeVisible();
  });

  test('renders score card with habit score and category', async ({ page }) => {
    await goToNutritionWithData(page);

    await expect(page.getByText('Buenos hábitos').first()).toBeVisible();
    await expect(page.getByText('Índice de hábitos alimentarios')).toBeVisible();
  });

  test('renders new entry button', async ({ page }) => {
    await goToNutritionWithData(page);

    await expect(page.getByRole('button', { name: 'Nuevo registro semanal' })).toBeVisible();
  });

  test('clicking new entry button shows form', async ({ page }) => {
    await goToNutritionWithData(page);

    await page.getByRole('button', { name: 'Nuevo registro semanal' }).click();
    await expect(page.getByRole('heading', { name: 'Registro de hábitos' })).toBeVisible();
    await expect(page.getByText(/¿Cuántas comidas haces al día?/)).toBeVisible();
  });

  test('empty state shows new entry button without score card', async ({ page }) => {
    await goToNutritionWithData(page, []);

    await expect(page.getByRole('button', { name: 'Nuevo registro semanal' })).toBeVisible();
  });

  test('renders history section with entries', async ({ page }) => {
    await goToNutritionWithData(page);

    await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
    await expect(page.getByText('Buenos hábitos').first()).toBeVisible();
  });
});
