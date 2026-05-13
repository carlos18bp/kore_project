import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Customer Pending Assessments flow (visible on /dashboard).
 * Covers KÓRE score display, module breakdown, empty state, and diagnostic module cards.
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

  async function goToDashboardWithKore(page: import('@playwright/test').Page, koreIndex = fakeKoreIndex) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page, ['my-pending-assessments']);
    await page.route('**/api/my-pending-assessments/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nutrition_due: false,
          parq_due: false,
          latest_anthropometry_at: null,
          latest_posturometry_at: null,
          latest_physical_eval_at: null,
          profile_incomplete: false,
          subscription_expiring: false,
          kore_index: koreIndex,
        }),
      });
    });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  }

  test('renders KÓRE score with category and message', async ({ page }) => {
    await goToDashboardWithKore(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Calificación KÓRE').filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Bueno').filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText(/Tu progreso es constante/).filter({ visible: true })).toBeVisible();
  });

  test('renders module breakdown bars', async ({ page }) => {
    await goToDashboardWithKore(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Calificación KÓRE').filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Composición').filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Postura').filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Condición').filter({ visible: true }).first()).toBeVisible();
  });

  test('renders modules evaluated count', async ({ page }) => {
    await goToDashboardWithKore(page);

    await expect(
      page.getByRole('main').getByText(/5 de 6 módulos evaluados/).filter({ visible: true }),
    ).toBeVisible();
  });

  test('empty KÓRE score shows placeholder message', async ({ page }) => {
    const emptyKore = {
      kore_score: null as unknown as number,
      kore_color: 'green',
      kore_category: '',
      kore_message: '',
      components: {} as typeof fakeKoreIndex['components'],
      modules_available: 0,
      modules_total: 6,
    };
    await goToDashboardWithKore(page, emptyKore);

    const main = page.getByRole('main');
    await expect(main.getByText('Calificación KÓRE').filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText(/Completa tus evaluaciones/).filter({ visible: true })).toBeVisible();
  });
});
