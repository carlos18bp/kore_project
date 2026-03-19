import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Customer Diagnosis page (/my-diagnosis).
 * Covers hero summary cards, index cards, trainer notes, empty state, and diff badges.
 */
test.describe('Customer Diagnosis Page', { tag: [...FlowTags.CUSTOMER_DIAGNOSIS, RoleTags.USER] }, () => {

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
    notes: 'Buen progreso en masa muscular, seguir así.',
    recommendations: {},
  };

  async function goToDiagnosisWithData(page: import('@playwright/test').Page, evaluations = [fakeEvaluation]) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page, ['my-anthropometry']);
    await page.route('**/api/my-anthropometry/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(evaluations),
      });
    });
    await page.goto('/my-diagnosis');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi Diagnóstico' })).toBeVisible({ timeout: 15_000 });
  }

  test('renders page heading and last evaluation date', async ({ page }) => {
    await goToDiagnosisWithData(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Mi Diagnóstico' })).toBeVisible();
    await expect(page.getByText(/Última evaluación/i)).toBeVisible();
  });

  test('renders hero summary cards with weight, body fat, and lean mass', async ({ page }) => {
    await goToDiagnosisWithData(page);

    await expect(page.getByText('Peso actual')).toBeVisible();
    await expect(page.getByText('Grasa corporal', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Masa muscular', { exact: true }).first()).toBeVisible();
  });

  test('renders trainer notes when present', async ({ page }) => {
    await goToDiagnosisWithData(page);

    await expect(page.getByText('Tu entrenador dice')).toBeVisible();
    await expect(page.getByText(/Buen progreso en masa muscular/)).toBeVisible();
  });

  test('renders index cards section with expandable indicators', async ({ page }) => {
    await goToDiagnosisWithData(page);

    await expect(page.getByText('Tus indicadores en detalle')).toBeVisible();
    await expect(page.getByText('Tu composición corporal').first()).toBeVisible();
    await expect(page.getByText('Tu peso y estatura').first()).toBeVisible();
  });

  test('empty state shows placeholder when no evaluations exist', async ({ page }) => {
    await goToDiagnosisWithData(page, []);

    await expect(page.getByText('Tu diagnóstico está en camino')).toBeVisible();
    await expect(page.getByText(/Tu entrenador realizará tu primera evaluación/)).toBeVisible();
  });

  test('diff badges appear when multiple evaluations exist', async ({ page }) => {
    const previous = {
      ...fakeEvaluation,
      id: 2,
      evaluation_date: '2025-11-15',
      created_at: '2025-11-15T10:00:00Z',
      weight_kg: '82.0',
      body_fat_pct: '25.0',
      lean_mass_kg: '58.5',
      bmi: '26.8',
    };
    await goToDiagnosisWithData(page, [fakeEvaluation, previous]);

    await expect(page.getByText('Tu evolución')).toBeVisible();
  });
});
