import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Client Nutrition page (/trainer/clients/client/nutrition?clientId=X).
 * Covers nutrition entry display, habit scores, empty state.
 */
test.describe('Trainer Client Nutrition Page', { tag: [...FlowTags.TRAINER_CLIENT_NUTRITION, RoleTags.TRAINER] }, () => {

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
    notes: 'Buena semana alimentaria.',
    habit_score: '7.8',
    habit_category: 'Buenos hábitos',
    habit_color: 'green',
  };

  async function setupNutritionMocks(page: import('@playwright/test').Page, entries = [fakeEntry]) {
    await page.route('**/api/trainer/my-clients/1/nutrition/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(entries),
      });
    });
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_clients: 1, today_sessions: 0, upcoming_sessions: [] }),
      });
    });
    await page.route('**/api/trainer/my-clients/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  test('renders page heading and description', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionMocks(page);
    await page.goto('/trainer/clients/client/nutrition?clientId=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Nutrición del Cliente' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Historial de hábitos alimentarios/)).toBeVisible();
  });

  test('renders nutrition entry with habit score and category', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionMocks(page);
    await page.goto('/trainer/clients/client/nutrition?clientId=1');

    await expect(page.getByText('Buenos hábitos')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Comidas al día')).toBeVisible();
  });

  test('renders entry notes when present', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionMocks(page);
    await page.goto('/trainer/clients/client/nutrition?clientId=1');

    await expect(page.getByText('Buenos hábitos')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Buena semana alimentaria/)).toBeVisible();
  });

  test('empty state shows no entries message', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutritionMocks(page, []);
    await page.goto('/trainer/clients/client/nutrition?clientId=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Nutrición del Cliente' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/El cliente aún no ha registrado hábitos alimentarios/)).toBeVisible();
  });
});
