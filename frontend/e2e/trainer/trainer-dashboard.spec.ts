import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Dashboard page (/trainer/dashboard).
 * Covers greeting, stats cards, quick action link, upcoming sessions, and empty/loading states.
 */
test.describe('Trainer Dashboard Page', { tag: [...FlowTags.TRAINER_DASHBOARD, RoleTags.TRAINER] }, () => {

  const fakeStats = {
    total_clients: 8,
    today_sessions: 3,
    upcoming_sessions: [
      {
        id: 201,
        customer_id: 1,
        customer_name: 'María López',
        package_title: 'Plan Elite',
        starts_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
      },
      {
        id: 202,
        customer_id: 2,
        customer_name: 'Carlos Gómez',
        package_title: 'Plan Pro',
        starts_at: new Date(Date.now() + 26 * 3600_000).toISOString(),
      },
    ],
  };

  async function setupDashboardMocks(page: import('@playwright/test').Page, stats = fakeStats) {
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stats),
      });
    });
    await page.route('**/api/trainer/my-clients/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  test('renders greeting with trainer first name', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Germán', { timeout: 15_000 });
    await expect(page.getByText('Panel del entrenador')).toBeVisible();
  });

  test('renders total clients stat card', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByText('Clientes', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('8', { exact: true })).toBeVisible();
    await expect(page.getByText('activos')).toBeVisible();
  });

  test('renders today sessions stat card', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByText('Sesiones hoy')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('3', { exact: true })).toBeVisible();
    await expect(page.getByText('programadas')).toBeVisible();
  });

  test('renders quick action link to clients page', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    const quickAction = page.getByRole('link', { name: /Ver clientes|Ir al listado/i });
    await expect(quickAction).toBeVisible({ timeout: 15_000 });
    await expect(quickAction).toHaveAttribute('href', '/trainer/clients');
  });

  test('renders upcoming sessions with client names', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByRole('heading', { name: 'Próximas sesiones' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('María López')).toBeVisible();
    await expect(page.getByText('Carlos Gómez')).toBeVisible();
  });

  test('upcoming session rows show package title', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plan Elite')).toBeVisible();
    await expect(page.getByText('Plan Pro')).toBeVisible();
  });

  test('empty upcoming sessions shows placeholder', async ({ page }) => {
    const emptyStats = { total_clients: 0, today_sessions: 0, upcoming_sessions: [] };
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page, emptyStats);
    await page.goto('/trainer/dashboard');

    await expect(page.getByRole('heading', { name: 'Próximas sesiones' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No hay sesiones próximas')).toBeVisible();
  });

  test('loading state shows dashes for stats', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    // Delay the API response to observe loading state
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fakeStats),
      });
    });
    await page.route('**/api/trainer/my-clients/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/trainer/dashboard');

    await expect(page.getByText('Panel del entrenador')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('—').first()).toBeVisible();
  });
});
