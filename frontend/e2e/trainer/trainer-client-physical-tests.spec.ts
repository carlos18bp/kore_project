import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the biweekly physical test section inside the Ev. Física tab
 * of the trainer client detail (/trainer/clients/client?id=X).
 * A passed test awards credits to the customer via the credits engine.
 */
test.describe('Trainer — test físico quincenal', { tag: [...FlowTags.TRAINER_CLIENT_PHYSICAL_TESTS, RoleTags.TRAINER] }, () => {

  const fakeClient = {
    id: 1,
    first_name: 'Ana',
    last_name: 'Ruiz',
    email: 'ana@example.com',
    subscription: null,
    last_payment: null,
    next_session: null,
    stats: { completed: 0, pending: 0, canceled: 0, total: 0 },
  };

  const fakeTest = {
    id: 1,
    customer: 1,
    trainer: 2,
    performed_at: '2026-07-01',
    result: 'passed',
    notes: 'Buen progreso',
    created_at: '2026-07-01T15:00:00Z',
  };

  async function setupMocks(page: import('@playwright/test').Page, tests: unknown[] = []) {
    await page.route('**/api/trainer/my-clients/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeClient) });
    });
    await page.route('**/api/trainer/my-clients/1/sessions/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    // 404 renders the resumen's stats fallback; an empty object would crash
    // the KPI branch (kpi.clinical.kore_score). The tab bar renders either way.
    await page.route('**/api/trainer/my-clients/1/kpi/', async (route) => {
      await route.fulfill({ status: 404, body: '' });
    });
    await page.route('**/api/trainer/my-clients/1/sessions-full/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/trainer/my-clients/1/alerts/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/trainer/my-clients/1/physical-evaluation/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ total_clients: 1, today_sessions: 0, upcoming_sessions: [] }),
      });
    });
    await page.route('**/api/trainer/my-clients/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/trainer/physical-tests/**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(fakeTest) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tests) });
      }
    });
  }

  test('shows the empty state inside the Ev. Física tab', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMocks(page, []);
    await page.goto('/trainer/clients/client?id=1');

    await page.getByRole('button', { name: 'Ev. Física' }).click();
    await expect(page.getByTestId('physical-test-section')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Sin tests registrados aún', { exact: false })).toBeVisible();
  });

  test('registers a passed test and shows it as the latest', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMocks(page, []);
    await page.goto('/trainer/clients/client?id=1');

    await page.getByRole('button', { name: 'Ev. Física' }).click();
    await page.getByRole('button', { name: 'Registrar test' }).click();
    await expect(page.getByTestId('physical-test-form')).toBeVisible();
    await page.getByRole('button', { name: 'Aprobado', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar test' }).click();

    await expect(page.getByText('Último test:')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Aprobado', { exact: true })).toBeVisible();
  });

  test('shows the existing history with result badges', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMocks(page, [
      fakeTest,
      { ...fakeTest, id: 2, performed_at: '2026-06-15', result: 'failed', notes: '' },
    ]);
    await page.goto('/trainer/clients/client?id=1');

    await page.getByRole('button', { name: 'Ev. Física' }).click();
    await expect(page.getByText('Último test:')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Ver historial/ }).click();
    await expect(page.getByText('No aprobado')).toBeVisible();
  });
});
