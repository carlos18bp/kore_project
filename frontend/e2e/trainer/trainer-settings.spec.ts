import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:trainer-settings
 * The trainer configures the credit economy: difficulty preset and the
 * reschedule window that governs the block, the penalty and the client's UI.
 */

const SETTINGS = {
  difficulty: 'medium',
  action_values: { workout_day: 15, meal_photo: 5, no_show_penalty: -40 },
  streak_bonuses: { '3': 20, '7': 50 },
  training_day_threshold: 0.7,
  nutrition_min_meals: 3,
  water_goal_glasses: 8,
  meal_review_days: 3,
  reschedule_window_hours: 24,
  require_workout_captures: true,
};

test.describe('Trainer — configuración', { tag: [...FlowTags.TRAINER_SETTINGS, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await injectTrainerAuthCookies(page);
  });

  test('switching the difficulty asks for confirmation and reseeds the values', async ({ page }) => {
    let put: Record<string, unknown> | null = null;
    await page.route('**/api/credits/settings/', (r) => {
      if (r.request().method() === 'PUT') {
        put = r.request().postDataJSON();
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...SETTINGS, difficulty: 'hard', action_values: { workout_day: 10 } }),
        });
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SETTINGS),
      });
    });

    await page.goto('/trainer/configuracion');
    await expect(page.getByTestId('trainer-settings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Día de entrenamiento')).toBeVisible();

    await page.getByTestId('difficulty-hard').click();

    // The reseed is destructive, so it is stated before it happens.
    await expect(page.getByText('Se reescribirán los puntos', { exact: false })).toBeVisible();
    await page.getByTestId('difficulty-confirm').click();

    expect(put).toMatchObject({ difficulty: 'hard', action_values: {}, streak_bonuses: {} });
  });

  test('saves the reschedule window', async ({ page }) => {
    let put: Record<string, unknown> | null = null;
    await page.route('**/api/credits/settings/', (r) => {
      if (r.request().method() === 'PUT') {
        put = r.request().postDataJSON();
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...SETTINGS, reschedule_window_hours: 48 }),
        });
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SETTINGS),
      });
    });

    await page.goto('/trainer/configuracion');
    await expect(page.getByTestId('trainer-settings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('reschedule-window')).toHaveValue('24');

    await page.getByTestId('reschedule-window').fill('48');
    await page.getByTestId('settings-save').click();

    await expect(page.getByText('Guardado')).toBeVisible();
    expect(put).toMatchObject({ reschedule_window_hours: 48 });
  });
});
