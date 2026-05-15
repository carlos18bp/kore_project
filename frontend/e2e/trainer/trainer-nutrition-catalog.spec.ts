import type { Page } from '@playwright/test';
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeSuggestions = [
  { id: 1, title: 'Avena con frutas', meal_block: 'desayuno', description: 'Rico en fibra', calories_estimate: 320, nova_max: 1, goal_tags: ['general_health'], fitness_level_min: 1, fitness_level_max: 5, is_active: true, created_at: '2026-05-01T08:00:00Z' },
  { id: 2, title: 'Pollo con arroz', meal_block: 'almuerzo', description: 'Alto en proteína', calories_estimate: 520, nova_max: 1, goal_tags: ['muscle_gain'], fitness_level_min: 1, fitness_level_max: 5, is_active: true, created_at: '2026-05-02T08:00:00Z' },
];

async function setupNutritionCatalogMocks(page: Page, suggestions = fakeSuggestions) {
  await page.route('**/api/meal-suggestions/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ results: suggestions, count: suggestions.length, next: null, previous: null }),
      });
    } else if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: 99, ...body, is_active: true, created_at: '2026-05-15T10:00:00Z' }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe('Trainer Nutrition Catalog', { tag: [...FlowTags.TRAINER_NUTRITION_CATALOG, RoleTags.TRAINER] }, () => {
  test('page loads with Catálogo global heading', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionCatalogMocks(page);
    await page.goto('/trainer/nutrition-catalog');

    await expect(page.getByText('Catálogo global')).toBeVisible({ timeout: 15_000 });
  });

  test('table shows Nombre, Bloque, Kcal columns', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionCatalogMocks(page);
    await page.goto('/trainer/nutrition-catalog');

    await expect(page.getByRole('columnheader', { name: 'Nombre' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Bloque' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Kcal' })).toBeVisible();
  });

  test('suggestion rows appear in the table', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionCatalogMocks(page);
    await page.goto('/trainer/nutrition-catalog');

    await expect(page.getByText('Avena con frutas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Pollo con arroz')).toBeVisible();
  });

  test('meal block filter pill filters the list', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionCatalogMocks(page);
    // Override to return filtered results when meal_block param is present
    await page.route('**/api/meal-suggestions/?**meal_block=desayuno**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ results: [fakeSuggestions[0]], count: 1, next: null, previous: null }),
      });
    });
    await page.goto('/trainer/nutrition-catalog');

    await expect(page.getByRole('button', { name: 'Desayuno' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Desayuno' }).click();

    await expect(page.getByText('Avena con frutas')).toBeVisible({ timeout: 8_000 });
  });

  test('add form is visible with Nueva sugerencia label', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionCatalogMocks(page);
    await page.goto('/trainer/nutrition-catalog');

    await expect(page.getByText('Nueva sugerencia')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Nombre de la comida *')).toBeVisible();
  });

  test('empty suggestions list shows empty table gracefully', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionCatalogMocks(page, []);
    await page.goto('/trainer/nutrition-catalog');

    await expect(page.getByText('Catálogo global')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No se encontraron sugerencias con ese filtro.')).toBeVisible();
  });
});
