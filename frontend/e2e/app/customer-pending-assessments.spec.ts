import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Customer Pending Assessments flow surfaced on /dashboard.
 * After the redesign the dashboard no longer renders a dedicated KÓRE module-breakdown
 * card; the pending-assessments payload now drives:
 *  - the compact "KÓRE {score}" badge link in the header stats row,
 *  - the personalised motivation message (kore_message),
 *  - and a "due" dot on the sidebar nav item for assessments that need attention.
 */
test.describe('Customer Pending Assessments (Dashboard)', { tag: [...FlowTags.CUSTOMER_PENDING_ASSESSMENTS, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const fakeKoreIndex = {
    kore_score: 72,
    kore_color: 'green',
    kore_category: 'Bueno',
    kore_message: 'Tu progreso es constante, sigue así.',
    components: {
      anthropometry: 78,
      metabolic_risk: 65,
      posturometry: 70,
      physical: 80,
      mood: 75,
      nutrition: 64,
    },
    modules_available: 5,
    modules_total: 6,
  };

  // Minimal anthropometry evaluation so the dashboard renders the evaluation grid
  // (which hosts the personalised motivation card driven by kore_message).
  const fakeAnthroEvaluation = {
    id: 1,
    customer_id: 999,
    trainer_name: 'Germán Franco',
    evaluation_date: '2026-01-15',
    created_at: '2026-01-15T10:00:00Z',
    weight_kg: '78.5',
    height_cm: '175',
    waist_cm: '88',
    hip_cm: '98',
    perimeters: {},
    skinfolds: {},
    notes: '',
    recommendations: {},
    age_at_evaluation: 36,
    bmi: '25.6',
    bmi_category: 'Sobrepeso',
    bmi_color: 'yellow',
    waist_hip_ratio: '0.90',
    whr_risk: 'Riesgo moderado',
    whr_color: 'yellow',
    waist_height_ratio: '0.50',
    whe_risk: 'Normal',
    whe_color: 'green',
    body_fat_pct: '22.5',
    bf_category: 'Normal',
    bf_color: 'green',
    bf_method: 'skinfolds',
    fat_mass_kg: '17.6',
    lean_mass_kg: '60.9',
    waist_risk: 'Riesgo moderado',
    waist_risk_color: 'yellow',
    sum_skinfolds: '90',
    asymmetries: {},
  };

  type PendingPayload = {
    nutrition_due?: boolean;
    parq_due?: boolean;
    kore_index?: typeof fakeKoreIndex | { kore_score: null } & Omit<typeof fakeKoreIndex, 'kore_score'> | null;
  };

  async function goToDashboard(page: import('@playwright/test').Page, payload: PendingPayload = {}) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page, ['my-pending-assessments', 'my-anthropometry']);
    await page.route('**/api/my-anthropometry/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeAnthroEvaluation]) });
    });
    await page.route('**/api/my-pending-assessments/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nutrition_due: payload.nutrition_due ?? false,
          parq_due: payload.parq_due ?? false,
          latest_anthropometry_at: null,
          latest_posturometry_at: null,
          latest_physical_eval_at: null,
          profile_incomplete: false,
          subscription_expiring: false,
          kore_index: payload.kore_index === undefined ? fakeKoreIndex : payload.kore_index,
        }),
      });
    });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  }

  test('renders the KÓRE score badge with the computed score', async ({ page }) => {
    await goToDashboard(page);

    const badge = page.getByRole('link', { name: 'Tu calificación KÓRE' }).first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('72');
  });

  test('renders the personalised KÓRE motivation message', async ({ page }) => {
    await goToDashboard(page);

    await expect(
      page.getByRole('main').getByText(/Tu progreso es constante/).filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test('shows a "due" indicator on the nutrition nav item when nutrition is due', async ({ page }) => {
    await goToDashboard(page, { nutrition_due: true });

    const nutritionNav = page.getByRole('link', { name: 'Mi Nutrición' });
    await expect(nutritionNav.locator('span.animate-pulse')).toBeVisible();
  });

  test('hides the KÓRE score badge when no score has been computed yet', async ({ page }) => {
    await goToDashboard(page, { kore_index: null });

    await expect(page.getByRole('link', { name: 'Tu calificación KÓRE' })).toHaveCount(0);
    await expect(
      page.getByRole('main').getByText(/Cada día que entrenas/).filter({ visible: true }).first(),
    ).toBeVisible();
  });
});
