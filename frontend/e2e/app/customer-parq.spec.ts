import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Customer PAR-Q page (/my-parq).
 * Covers risk assessment display, questionnaire form, history, and empty state.
 */
test.describe('Customer PAR-Q Page', { tag: [...FlowTags.CUSTOMER_PARQ, RoleTags.USER] }, () => {

  const fakeAssessment = {
    id: 1,
    created_at: '2026-01-10T10:00:00Z',
    q1_heart_condition: false,
    q2_chest_pain: false,
    q3_dizziness: false,
    q4_chronic_condition: false,
    q5_prescribed_medication: false,
    q6_bone_joint_problem: false,
    q7_medical_supervision: false,
    additional_notes: '',
    yes_count: 0,
    risk_label: 'Riesgo bajo',
    risk_color: 'green',
  };

  async function goToParqWithData(page: import('@playwright/test').Page, assessments = [fakeAssessment]) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page, ['my-parq']);
    await page.route('**/api/my-parq/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(assessments),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(fakeAssessment),
        });
      }
    });
    await page.goto('/my-parq');
    await expect(page.getByRole('heading', { level: 1, name: 'PAR-Q+' })).toBeVisible({ timeout: 15_000 });
  }

  test('renders page heading and description', async ({ page }) => {
    await goToParqWithData(page);

    await expect(page.getByRole('heading', { level: 1, name: 'PAR-Q+' })).toBeVisible();
    await expect(page.getByText(/Cuestionario de Preparación para la Actividad Física/)).toBeVisible();
  });

  test('renders latest risk assessment badge', async ({ page }) => {
    await goToParqWithData(page);

    await expect(page.getByText('Riesgo bajo').first()).toBeVisible();
    await expect(page.getByText('0 de 7 respuestas afirmativas').first()).toBeVisible();
  });

  test('renders update button when assessment exists', async ({ page }) => {
    await goToParqWithData(page);

    await expect(page.getByRole('button', { name: /Actualizar PAR-Q/i })).toBeVisible();
  });

  test('clicking update button shows questionnaire form', async ({ page }) => {
    await goToParqWithData(page);

    await page.getByRole('button', { name: /Actualizar PAR-Q/i }).click();
    await expect(page.getByRole('heading', { name: 'Preguntas generales de salud' })).toBeVisible();
    await expect(page.getByText(/¿Algún médico le ha dicho que tiene una condición cardíaca/)).toBeVisible();
  });

  test('empty state shows complete button', async ({ page }) => {
    await goToParqWithData(page, []);

    await expect(page.getByRole('button', { name: 'Completar PAR-Q' })).toBeVisible();
  });

  test('high risk assessment shows red badge', async ({ page }) => {
    const highRisk = {
      ...fakeAssessment,
      q1_heart_condition: true,
      q2_chest_pain: true,
      q4_chronic_condition: true,
      yes_count: 3,
      risk_label: 'Riesgo alto',
      risk_color: 'red',
    };
    await goToParqWithData(page, [highRisk]);

    await expect(page.getByText('Riesgo alto').first()).toBeVisible();
    await expect(page.getByText('3 de 7 respuestas afirmativas').first()).toBeVisible();
  });
});
