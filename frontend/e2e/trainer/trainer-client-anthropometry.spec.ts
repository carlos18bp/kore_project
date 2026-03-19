import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Client Anthropometry page (/trainer/clients/client/anthropometry?id=X).
 * Covers evaluation history, create form, calculated indices, empty state, and back link.
 */
test.describe('Trainer Client Anthropometry Page', { tag: [...FlowTags.TRAINER_CLIENT_ANTHROPOMETRY, RoleTags.TRAINER] }, () => {

  const fakeEvaluation = {
    id: 1,
    evaluation_date: '2026-01-15',
    created_at: '2026-01-15T10:00:00Z',
    weight_kg: '78.5',
    height_cm: '175',
    bmi: '25.6',
    bmi_category: 'Sobrepeso',
    bmi_color: 'yellow',
    waist_cm: '88',
    hip_cm: '98',
    waist_hip_ratio: '0.90',
    whr_risk: 'Riesgo moderado',
    whr_color: 'yellow',
    waist_risk: 'Riesgo moderado',
    waist_risk_color: 'yellow',
    body_fat_pct: '22.5',
    bf_category: 'Normal',
    bf_color: 'green',
    fat_mass_kg: '17.6',
    lean_mass_kg: '60.9',
    notes: '',
    recommendations: {},
    perimeters: {},
    skinfolds: {},
  };

  async function setupAnthropometryMocks(page: import('@playwright/test').Page, evaluations = [fakeEvaluation]) {
    await page.route('**/api/trainer/my-clients/1/anthropometry/', async (route) => {
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
    await setupAnthropometryMocks(page);
    await page.goto('/trainer/clients/client/anthropometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Antropometría' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Volver al cliente/i })).toBeVisible();
  });

  test('renders new evaluation button', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAnthropometryMocks(page);
    await page.goto('/trainer/clients/client/anthropometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Antropometría' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Nueva evaluación/i })).toBeVisible();
  });

  test('clicking new evaluation shows form with basic fields', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAnthropometryMocks(page);
    await page.goto('/trainer/clients/client/anthropometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Antropometría' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Nueva evaluación/i }).click();

    await expect(page.getByText('Datos básicos')).toBeVisible();
    await expect(page.getByText('Peso (kg)')).toBeVisible();
    await expect(page.getByText('Estatura (cm)')).toBeVisible();
  });

  test('renders calculated index cards when evaluation exists', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAnthropometryMocks(page);
    await page.goto('/trainer/clients/client/anthropometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Antropometría' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('IMC', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Sobrepeso').first()).toBeVisible();
  });

  test('empty state shows only new evaluation button', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAnthropometryMocks(page, []);
    await page.goto('/trainer/clients/client/anthropometry?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'Antropometría' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Nueva evaluación/i })).toBeVisible();
  });
});
