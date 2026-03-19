import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Customer Physical Evaluation page (/my-physical-evaluation).
 * Covers hero summary, fitness index cards, test scores, empty state, and progress timeline.
 */
test.describe('Customer Physical Evaluation Page', { tag: [...FlowTags.CUSTOMER_PHYSICAL_EVALUATION, RoleTags.USER] }, () => {

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
    notes: 'Buen rendimiento en fuerza, mejorar resistencia cardiovascular.',
    recommendations: {},
  };

  async function goToPhysicalEvalWithData(page: import('@playwright/test').Page, evaluations = [fakeEvaluation]) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page, ['my-physical-evaluation']);
    await page.route('**/api/my-physical-evaluation/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(evaluations),
      });
    });
    await page.goto('/my-physical-evaluation');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi Condición Física' })).toBeVisible({ timeout: 15_000 });
  }

  test('renders page heading and last evaluation date', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Mi Condición Física' })).toBeVisible();
    await expect(page.getByText(/Última evaluación/i)).toBeVisible();
  });

  test('renders hero summary cards for all fitness components', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    await expect(page.getByText('General', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Fuerza', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Resistencia', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Movilidad', { exact: true }).first()).toBeVisible();
  });

  test('renders test scores section with individual results', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    await expect(page.getByText('Tus resultados por prueba')).toBeVisible();
    await expect(page.getByText('Sentadillas').first()).toBeVisible();
    await expect(page.getByText('Flexiones').first()).toBeVisible();
    await expect(page.getByText('Plancha').first()).toBeVisible();
  });

  test('renders trainer notes when present', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    await expect(page.getByText('Tu entrenador dice')).toBeVisible();
    await expect(page.getByText(/Buen rendimiento en fuerza/)).toBeVisible();
  });

  test('renders expandable index cards section', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    await expect(page.getByText('Tus componentes en detalle')).toBeVisible();
    await expect(page.getByText('Tu condición física general').first()).toBeVisible();
  });

  test('empty state shows placeholder when no evaluations exist', async ({ page }) => {
    await goToPhysicalEvalWithData(page, []);

    await expect(page.getByText('Tu evaluación física está en camino')).toBeVisible();
    await expect(page.getByText(/Tu entrenador realizará tu primera evaluación/)).toBeVisible();
  });
});
