import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Clients page (/trainer/clients).
 * Covers the redesigned client roster (desktop table), search filtering, filter chips,
 * empty states and risk badges.
 *
 * Note: the page renders both a mobile card list and a desktop table simultaneously
 * (toggled with CSS only), so client-row assertions are scoped to the desktop <table>.
 */
test.describe('Trainer Clients Page', { tag: [...FlowTags.TRAINER_CLIENTS_LIST, RoleTags.TRAINER] }, () => {

  const fakeClients = [
    {
      id: 1,
      first_name: 'María',
      last_name: 'López',
      email: 'maria@example.com',
      avatar_url: null,
      primary_goal: 'fat_loss',
      active_package: 'Plan Elite',
      sessions_remaining: 3,
      total_sessions: 8,
      completed_sessions: 5,
      last_session_date: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 2,
      first_name: 'Carlos',
      last_name: 'Gómez',
      email: 'carlos@example.com',
      avatar_url: null,
      primary_goal: 'muscle_gain',
      active_package: 'Plan Pro',
      sessions_remaining: 0,
      total_sessions: 12,
      completed_sessions: 12,
      last_session_date: null,
    },
  ];

  const fakeRiskDashboard = {
    risk_summary: { alto: 1, medio: 0, bajo: 0, sin_riesgo: 1 },
    clients_by_risk: [
      {
        id: 11,
        customer_id: 1,
        customer_name: 'María López',
        avatar_url: null,
        level: 'alto',
        computed_at: new Date().toISOString(),
        kore_score: 58,
        signals_count: 2,
        behavioral_signals: [],
        clinical_signals: [],
        resolutions: [],
      },
    ],
  };

  const fakeComparativeMetrics = {
    adherence_ranking: [{ customer_id: 1, name: 'María López', avatar_url: null, combined_7d: 0.82, delta_vs_last_week: 0.05, trend: 'up' }],
    improved_this_week: [],
    worsened_this_week: [],
    global_patterns: { avg_training_adherence: 0.7, avg_nutrition_adherence: 0.6, most_missed_day_of_week: null },
    expired_evaluations: [],
  };

  async function setupTrainerClientsMocks(page: import('@playwright/test').Page, clients = fakeClients) {
    await page.route('**/api/trainer/my-clients/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(clients) });
    });
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_clients: clients.length, today_sessions: 0, upcoming_sessions: [] }),
      });
    });
    await page.route('**/api/trainer/risk-dashboard/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeRiskDashboard) });
    });
    await page.route('**/api/trainer/comparative-metrics/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeComparativeMetrics) });
    });
  }

  test('renders page heading and search input', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByRole('heading', { level: 1, name: 'Mis Clientes' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('Buscar por nombre o email...')).toBeVisible();
  });

  test('renders client rows with names and emails', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    const table = page.getByRole('table');
    await expect(table.getByText('María López')).toBeVisible({ timeout: 15_000 });
    await expect(table.getByText('maria@example.com')).toBeVisible();
    await expect(table.getByText('Carlos Gómez')).toBeVisible();
    await expect(table.getByText('carlos@example.com')).toBeVisible();
  });

  test('renders client program names in the table', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    const table = page.getByRole('table');
    await expect(table.getByText('Plan Elite')).toBeVisible({ timeout: 15_000 });
    await expect(table.getByText('Plan Pro')).toBeVisible();
  });

  test('renders filter chips', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByRole('button', { name: 'Todos' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Riesgo alto' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eval pendiente' })).toBeVisible();
  });

  test('renders risk badge for high-risk client', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    const table = page.getByRole('table');
    await expect(table.getByText('María López')).toBeVisible({ timeout: 15_000 });
    await expect(table.getByText('Riesgo alto')).toBeVisible();
  });

  test('search filters clients by name', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    const table = page.getByRole('table');
    await expect(table.getByText('María López')).toBeVisible({ timeout: 15_000 });
    await expect(table.getByText('Carlos Gómez')).toBeVisible();

    await page.getByPlaceholder('Buscar por nombre o email...').fill('María');

    await expect(table.getByText('María López')).toBeVisible();
    await expect(table.getByText('Carlos Gómez')).not.toBeVisible();
  });

  test('search filters clients by email', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    const table = page.getByRole('table');
    await expect(table.getByText('María López')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Buscar por nombre o email...').fill('carlos@');

    await expect(table.getByText('Carlos Gómez')).toBeVisible();
    await expect(table.getByText('María López')).not.toBeVisible();
  });

  test('search with no results shows filter empty message', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByRole('table').getByText('María López')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Buscar por nombre o email...').fill('nonexistent');

    await expect(page.getByText('Sin resultados para ese filtro.')).toBeVisible();
  });

  test('empty client list shows placeholder', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page, []);
    await page.goto('/trainer/clients');

    await expect(page.getByRole('heading', { level: 1, name: 'Mis Clientes' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Aún no tienes clientes asignados.')).toBeVisible();
  });

  test('clicking a client row navigates to the client detail page', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.route('**/api/trainer/my-clients/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/trainer/clients');

    const table = page.getByRole('table');
    await expect(table.getByText('María López')).toBeVisible({ timeout: 15_000 });
    await table.getByText('María López').click();

    await page.waitForURL('**/trainer/clients/client?id=1');
  });
});
