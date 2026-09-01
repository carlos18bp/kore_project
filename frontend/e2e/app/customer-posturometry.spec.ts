import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the redesigned Customer Posturometry page (/my-posturometry).
 * Covers the global-index hero, the 4 per-region cards, the 4 per-view sections,
 * trainer notes, the empty state, and the inline before/after photo frames.
 */
test.describe('Customer Posturometry Page', { tag: [...FlowTags.CUSTOMER_POSTUROMETRY, RoleTags.USER] }, () => {

  const fakeEvaluation = {
    id: 1,
    trainer_name: 'Germán Franco',
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
    notes: 'Zona superior presenta ligera protracción de hombros.',
    recommendations: {},
    segment_scores: {
      head_tilt: { label: 'Inclinación de cabeza', score: 1 },
      shoulder_level: { label: 'Nivel de hombros', score: 2 },
      hip_alignment: { label: 'Alineación de cadera', score: 1 },
    },
    findings: {},
    anterior_photo: null,
    lateral_right_photo: null,
    lateral_left_photo: null,
    posterior_photo: null,
    anterior_observations: '',
    lateral_right_observations: '',
    lateral_left_observations: '',
    posterior_observations: '',
  };

  async function goToPosturometryWithData(page: import('@playwright/test').Page, evaluations = [fakeEvaluation]) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page, ['my-posturometry']);
    await page.route('**/api/my-posturometry/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(evaluations),
      });
    });
    await page.goto('/my-posturometry');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  }

  test('renders the page heading and last evaluation date', async ({ page }) => {
    await goToPosturometryWithData(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Posturometría' })).toBeVisible();
    await expect(page.getByText(/Última evaluación · /i).first()).toBeVisible();
  });

  test('renders the global-index hero', async ({ page }) => {
    await goToPosturometryWithData(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Índice postural global').filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Mapa por región').filter({ visible: true })).toBeVisible();
  });

  test('renders region cards for all four body regions', async ({ page }) => {
    await goToPosturometryWithData(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Por región', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Global', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(main.getByText('Tren superior', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Tren central', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(main.getByText('Tren inferior', { exact: true }).filter({ visible: true })).toBeVisible();
  });

  test('renders trainer notes when present', async ({ page }) => {
    await goToPosturometryWithData(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Notas de tu trainer').filter({ visible: true })).toBeVisible();
    await expect(main.getByText(/protracción de hombros/).filter({ visible: true })).toBeVisible();
  });

  test('renders the per-view sections with the four photographic views', async ({ page }) => {
    await goToPosturometryWithData(page);

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Vista anterior' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Vista lateral derecha' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Vista posterior' })).toBeVisible();
  });

  test('empty state shows the placeholder when no evaluations exist', async ({ page }) => {
    await goToPosturometryWithData(page, []);

    await expect(page.getByRole('heading', { level: 1, name: 'Mi Postura' })).toBeVisible();
    await expect(page.getByText('Tu evaluación postural está en camino')).toBeVisible();
    await expect(page.getByText(/Tu entrenador realizará tu primera evaluación de postura/)).toBeVisible();
  });

  test('opens the photo compare lightbox, zooms with a tap and closes with Escape', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    const previousEvaluation = {
      ...fakeEvaluation,
      id: 2,
      evaluation_date: '2025-12-01',
      created_at: '2025-12-01T10:00:00Z',
      anterior_photo: '/images/tree.png?registro=anterior-previo',
    };
    const currentEvaluation = {
      ...fakeEvaluation,
      id: 1,
      anterior_photo: '/images/tree.png?registro=anterior-actual',
    };
    await goToPosturometryWithData(page, [currentEvaluation, previousEvaluation]);

    await page.getByRole('button', { name: 'Comparar fotos en grande' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Inicial', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Última', { exact: true })).toBeVisible();

    const latestPhoto = dialog.getByRole('img', { name: 'Última' });
    await expect(latestPhoto).toHaveCSS('cursor', 'zoom-in');
    await latestPhoto.click();
    await expect(latestPhoto).toHaveCSS('cursor', 'zoom-out');

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('shows the before/after timeline section once two evaluations exist', async ({ page }) => {
    const previousEvaluation = {
      ...fakeEvaluation,
      id: 2,
      evaluation_date: '2025-12-01',
      created_at: '2025-12-01T10:00:00Z',
      global_index: '1.05',
      anterior_photo: '/images/tree.png?registro=anterior-previo',
    };
    const currentEvaluation = {
      ...fakeEvaluation,
      id: 1,
      anterior_photo: '/images/tree.png?registro=anterior-actual',
    };
    await goToPosturometryWithData(page, [currentEvaluation, previousEvaluation]);

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Tu línea de tiempo postural' })).toBeVisible();
    await expect(main.getByText('2 evaluaciones registradas').filter({ visible: true })).toBeVisible();
  });
});
