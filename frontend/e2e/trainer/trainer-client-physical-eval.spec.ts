import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Client Physical Evaluation page
 * (/trainer/clients/client/physical-evaluation?id=X).
 * Covers evaluation history, create form, fitness indicators, empty state.
 */
test.describe('Trainer Client Physical Evaluation Page', { tag: [...FlowTags.TRAINER_CLIENT_PHYSICAL_EVAL, RoleTags.TRAINER] }, () => {

  const fakeEvaluation = {
    id: 1,
    evaluation_date: '2026-01-15',
    created_at: '2026-01-15T10:00:00Z',
    squats_reps: 30,
    squats_score: 4,
    pushups_reps: 20,
    pushups_score: 3,
    plank_seconds: 60,
    plank_score: 4,
    walk_meters: 550,
    walk_score: 3,
    hip_mobility: 4,
    shoulder_mobility: 3,
    ankle_mobility: 3,
    unipodal_seconds: 25,
    unipodal_score: 3,
    strength_index: '3.67',
    strength_category: 'Intermedio',
    strength_color: 'yellow',
    endurance_index: '3.00',
    endurance_category: 'Intermedio',
    endurance_color: 'yellow',
    mobility_index: '3.33',
    mobility_category: 'Intermedio',
    mobility_color: 'yellow',
    balance_index: '3.00',
    balance_category: 'Intermedio',
    balance_color: 'yellow',
    general_index: '3.25',
    general_category: 'Intermedio',
    general_color: 'yellow',
    notes: '',
    recommendations: {},
    squats_notes: '',
    pushups_notes: '',
    plank_notes: '',
    walk_notes: '',
    unipodal_notes: '',
    squats_pain: false,
    pushups_pain: false,
    squats_interrupted: false,
  };

  async function setupPhysicalEvalMocks(page: import('@playwright/test').Page, evaluations = [fakeEvaluation]) {
    await page.route('**/api/trainer/my-clients/1/physical-evaluation/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(evaluations),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(fakeEvaluation),
        });
      }
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

  test('renders page heading and back link', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPhysicalEvalMocks(page);
    await page.goto('/trainer/clients/client/physical-evaluation?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Evaluación Física' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Volver al cliente/i })).toBeVisible();
  });

  test('renders new evaluation button', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPhysicalEvalMocks(page);
    await page.goto('/trainer/clients/client/physical-evaluation?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Evaluación Física' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Nueva evaluación/i })).toBeVisible();
  });

  test('renders fitness index cards when evaluation exists', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPhysicalEvalMocks(page);
    await page.goto('/trainer/clients/client/physical-evaluation?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Evaluación Física' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('General', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Fuerza', { exact: true }).first()).toBeVisible();
  });

  test('clicking new evaluation shows form with test fields', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPhysicalEvalMocks(page);
    await page.goto('/trainer/clients/client/physical-evaluation?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Evaluación Física' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Nueva evaluación/i }).click();

    await expect(page.getByText('Sentadillas en 1 minuto')).toBeVisible();
  });

  test('empty state shows only new evaluation button', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPhysicalEvalMocks(page, []);
    await page.goto('/trainer/clients/client/physical-evaluation?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Evaluación Física' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Nueva evaluación/i })).toBeVisible();
  });
});
