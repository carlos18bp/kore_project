import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Client Posturometry page
 * (/trainer/clients/client/posturometry?id=X).
 * Covers regional analysis, create form, global score, empty state.
 */
test.describe('Trainer Client Posturometry Page', { tag: [...FlowTags.TRAINER_CLIENT_POSTUROMETRY, RoleTags.TRAINER] }, () => {

  const fakeEvaluation = {
    id: 1,
    evaluation_date: '2026-01-15',
    created_at: '2026-01-15T10:00:00Z',
    global_index: '0.85',
    global_category: 'Desbalance leve',
    global_color: 'yellow',
    upper_index: '1.10',
    upper_category: 'Desbalance leve',
    upper_color: 'yellow',
    central_index: '0.60',
    central_category: 'Desbalance leve',
    central_color: 'yellow',
    lower_index: '0.40',
    lower_category: 'Funcional',
    lower_color: 'green',
    notes: '',
    recommendations: {},
    segment_scores: {},
    anterior_photo: null,
    lateral_right_photo: null,
    lateral_left_photo: null,
    posterior_photo: null,
    anterior: { segments: {} },
    lateral_right: { segments: {} },
    lateral_left: { segments: {} },
    posterior: { segments: {} },
  };

  async function setupPosturometryMocks(page: import('@playwright/test').Page, evaluations = [fakeEvaluation]) {
    await page.route('**/api/trainer/my-clients/1/posturometry/', async (route) => {
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
    await setupPosturometryMocks(page);
    await page.goto('/trainer/clients/client/posturometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Posturometría' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Volver al cliente/i })).toBeVisible();
  });

  test('renders new evaluation button', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPosturometryMocks(page);
    await page.goto('/trainer/clients/client/posturometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Posturometría' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Nueva evaluación/i })).toBeVisible();
  });

  test('renders regional index cards when evaluation exists', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPosturometryMocks(page);
    await page.goto('/trainer/clients/client/posturometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Posturometría' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Índice Global')).toBeVisible();
    await expect(page.getByText('Desbalance leve').first()).toBeVisible();
  });

  test('clicking new evaluation shows form with view tabs', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPosturometryMocks(page);
    await page.goto('/trainer/clients/client/posturometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Posturometría' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Nueva evaluación/i }).click();

    await expect(page.getByText('Anterior')).toBeVisible();
  });

  test('empty state shows only new evaluation button', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupPosturometryMocks(page, []);
    await page.goto('/trainer/clients/client/posturometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Posturometría' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Nueva evaluación/i })).toBeVisible();
  });
});
