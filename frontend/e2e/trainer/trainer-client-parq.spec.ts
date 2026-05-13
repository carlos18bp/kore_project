import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Client PAR-Q page (/trainer/clients/client/parq?clientId=X).
 * Covers PAR-Q assessment display, risk badges, question responses, and empty state.
 */
test.describe('Trainer Client PAR-Q Page', { tag: [...FlowTags.TRAINER_CLIENT_PARQ, RoleTags.TRAINER] }, () => {

  const fakeAssessment = {
    id: 1,
    created_at: '2026-01-10T10:00:00Z',
    q1_heart_condition: false,
    q2_chest_pain: false,
    q3_dizziness: false,
    q4_chronic_condition: true,
    q5_prescribed_medication: true,
    q6_bone_joint_problem: false,
    q7_medical_supervision: false,
    additional_notes: 'Diabetes tipo 2 controlada.',
    yes_count: 2,
    risk_label: 'Riesgo moderado',
    risk_color: 'yellow',
  };

  async function setupParqMocks(page: import('@playwright/test').Page, assessments = [fakeAssessment]) {
    await page.route('**/api/trainer/my-clients/1/parq/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(assessments),
      });
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

  test('renders page heading and description', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupParqMocks(page);
    await page.goto('/trainer/clients/client/parq?clientId=1');

    await expect(page.getByRole('heading', { level: 1, name: 'PAR-Q+ del Cliente' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Historial de evaluaciones PAR-Q/)).toBeVisible();
  });

  test('renders risk assessment badge with label and count', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupParqMocks(page);
    await page.goto('/trainer/clients/client/parq?clientId=1');

    await expect(page.getByText('Riesgo moderado')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/2\/7 afirmativas/)).toBeVisible();
  });

  test('renders individual question responses', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupParqMocks(page);
    await page.goto('/trainer/clients/client/parq?clientId=1');

    await expect(page.getByText('Riesgo moderado')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Condición médica crónica')).toBeVisible();
    await expect(page.getByText('Medicamentos recetados')).toBeVisible();
  });

  test('renders additional notes when present', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupParqMocks(page);
    await page.goto('/trainer/clients/client/parq?clientId=1');

    await expect(page.getByText('Riesgo moderado')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Diabetes tipo 2 controlada/)).toBeVisible();
  });

  test('empty state shows no assessments message', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupParqMocks(page, []);
    await page.goto('/trainer/clients/client/parq?clientId=1');

    await expect(page.getByRole('heading', { level: 1, name: 'PAR-Q+ del Cliente' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/El cliente aún no ha completado el PAR-Q/)).toBeVisible();
  });
});
