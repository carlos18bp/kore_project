import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the redesigned Customer Physical Evaluation page (/my-physical-evaluation).
 * Covers the general-index hero, the 5 per-capacity test cards, the mobility section,
 * the trainer notes, and the empty state.
 */
test.describe('Customer Physical Evaluation Page', { tag: [...FlowTags.CUSTOMER_PHYSICAL_EVALUATION, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const fakeEvaluation = {
    id: 1,
    trainer_name: 'Germán Franco',
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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  }

  test('renders the page heading and last evaluation date', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Evaluación Física' })).toBeVisible();
    await expect(page.getByText(/Última evaluación/i)).toBeVisible();
  });

  test('renders the general-index hero with the four capacity sub-indices', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await goToPhysicalEvalWithData(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Índice general de condición').filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Fuerza', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Resistencia', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Movilidad', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Balance', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('renders the per-capacity test cards', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Por capacidad', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Sentadillas', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Flexiones', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Plancha', { exact: true }).filter({ visible: true })).toBeVisible();
  });

  test('renders the mobility section with the three zones', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Cadera', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Hombro', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Tobillo', { exact: true }).filter({ visible: true })).toBeVisible();
  });

  test('renders trainer notes when present', async ({ page }) => {
    await goToPhysicalEvalWithData(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Notas de tu trainer').filter({ visible: true })).toBeVisible();
    await expect(main.getByText(/Buen rendimiento en fuerza/).filter({ visible: true })).toBeVisible();
  });

  test('empty state shows the placeholder when no evaluations exist', async ({ page }) => {
    await goToPhysicalEvalWithData(page, []);

    await expect(page.getByRole('heading', { level: 1, name: 'Mi Condición Física' })).toBeVisible();
    await expect(page.getByText('Tu evaluación física está en camino')).toBeVisible();
    await expect(page.getByText(/Tu entrenador realizará tus pruebas/)).toBeVisible();
  });
});
