import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Customer Posturometry page (/my-posturometry).
 * Covers global score, regional breakdowns, expandable cards, and empty state.
 */
test.describe('Customer Posturometry Page', { tag: [...FlowTags.CUSTOMER_POSTUROMETRY, RoleTags.USER] }, () => {

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
    notes: 'Zona superior presenta ligera protracción de hombros.',
    recommendations: {},
    segment_scores: {
      head_tilt: { label: 'Inclinación de cabeza', score: 1 },
      shoulder_level: { label: 'Nivel de hombros', score: 2 },
      hip_alignment: { label: 'Alineación de cadera', score: 1 },
    },
    anterior_photo: null,
    lateral_right_photo: null,
    lateral_left_photo: null,
    posterior_photo: null,
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
    await expect(page.getByRole('heading', { level: 1, name: 'Mi Postura' })).toBeVisible({ timeout: 15_000 });
  }

  test('renders page heading and last evaluation date', async ({ page }) => {
    await goToPosturometryWithData(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Mi Postura' })).toBeVisible();
    await expect(page.getByText(/Última evaluación/i)).toBeVisible();
  });

  test('renders index cards for all posture regions', async ({ page }) => {
    await goToPosturometryWithData(page);

    await expect(page.getByText('Tus zonas en detalle')).toBeVisible();
    await expect(page.getByText('Tu postura general').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Zona superior/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Zona central/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Zona inferior/ }).first()).toBeVisible();
  });

  test('renders trainer notes when present', async ({ page }) => {
    await goToPosturometryWithData(page);

    await expect(page.getByText('Tu entrenador dice')).toBeVisible();
    await expect(page.getByText(/protracción de hombros/)).toBeVisible();
  });

  test('renders top segments to work on section', async ({ page }) => {
    await goToPosturometryWithData(page);

    await expect(page.getByText('Principales zonas por trabajar')).toBeVisible();
    await expect(page.getByText('Nivel de hombros')).toBeVisible();
  });

  test('renders expandable region cards', async ({ page }) => {
    await goToPosturometryWithData(page);

    await expect(page.getByText('Tus zonas en detalle')).toBeVisible();
    await expect(page.getByText('Tu postura general').first()).toBeVisible();
    await expect(page.getByText('Zona superior').first()).toBeVisible();
  });

  test('empty state shows placeholder when no evaluations exist', async ({ page }) => {
    await goToPosturometryWithData(page, []);

    await expect(page.getByText('Tu evaluación postural está en camino')).toBeVisible();
    await expect(page.getByText(/Tu entrenador realizará tu primera evaluación postural/)).toBeVisible();
  });

  test('mobile photo sheet compares previous and current photos without scrolling the page behind it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    const longObservation = Array(12).fill('Observación detallada para forzar scroll interno del modal.').join(' ');
    const previousEvaluation = {
      ...fakeEvaluation,
      id: 1,
      evaluation_date: '2025-12-01',
      created_at: '2025-12-01T10:00:00Z',
      anterior_photo: '/images/tree.png?registro=anterior-previo',
      lateral_right_photo: '/images/tree.png?registro=lateral-previo',
      anterior_observations: longObservation,
      lateral_right_observations: longObservation,
      findings: {
        anterior: ['Hallazgo anterior previo'],
        lateral_right: ['Hallazgo lateral previo'],
      },
      segment_scores: {
        shoulder_level: { label: 'Nivel de hombros', score: 2, region: 'upper', views: { anterior: 2, lateral_right: 1 } },
      },
    };
    const currentEvaluation = {
      ...fakeEvaluation,
      id: 2,
      evaluation_date: '2026-01-15',
      created_at: '2026-01-15T10:00:00Z',
      anterior_photo: '/images/tree.png?registro=anterior-actual',
      lateral_right_photo: '/images/tree.png?registro=lateral-actual',
      anterior_observations: longObservation,
      lateral_right_observations: longObservation,
      findings: {
        anterior: ['Hallazgo anterior actual'],
        lateral_right: ['Hallazgo lateral actual'],
      },
      segment_scores: {
        shoulder_level: { label: 'Nivel de hombros', score: 2, region: 'upper', views: { anterior: 2, lateral_right: 1 } },
      },
    };

    await goToPosturometryWithData(page, [currentEvaluation, previousEvaluation]);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const pageScrollBeforeOpen = await page.evaluate(() => window.scrollY);

    await page.getByRole('button', { name: /Antes/ }).click();
    await page.getByRole('button', { name: 'Anterior (frente)' }).click();

    const sheet = page.getByTestId('posturometry-photo-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: /Antes/ })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /Después/ })).toBeVisible();
    const modalScroll = sheet.getByTestId('posturometry-photo-sheet-scroll');
    const modalImage = modalScroll.getByTestId('posturometry-photo-sheet-image');
    await expect(modalImage).toHaveAttribute('src', /registro=anterior-previo/);
    await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('fixed');

    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => document.body.style.top)).toBe(`-${pageScrollBeforeOpen}px`);

    await modalScroll.evaluate((el) => { el.scrollTop = 240; });
    await expect.poll(() => modalScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await sheet.getByRole('button', { name: /Después/ }).click();
    await expect(modalImage).toHaveAttribute('src', /registro=anterior-actual/);

    await sheet.getByRole('button', { name: 'Cerrar' }).click();
    await expect(sheet).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(pageScrollBeforeOpen);
  });
});
