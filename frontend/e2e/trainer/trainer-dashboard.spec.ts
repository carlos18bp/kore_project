import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Dashboard page (/trainer/dashboard).
 * Covers the greeting hero, agenda card, top-risk list and alerts preview.
 */
test.describe('Trainer Dashboard Page', { tag: [...FlowTags.TRAINER_DASHBOARD, RoleTags.TRAINER] }, () => {

  // Build an ISO timestamp for today at a fixed hour so sessions land inside the 07:00–21:00 agenda window.
  function todayAt(hour: number): string {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }

  const fakeStats = {
    total_clients: 8,
    today_sessions: 3,
    upcoming_sessions: [
      {
        id: 201,
        customer_id: 1,
        customer_name: 'María López',
        package_title: 'Plan Elite',
        starts_at: todayAt(10),
        ends_at: todayAt(11),
        status: 'confirmed',
      },
      {
        id: 202,
        customer_id: 2,
        customer_name: 'Carlos Gómez',
        package_title: 'Plan Pro',
        starts_at: todayAt(15),
        ends_at: todayAt(16),
        status: 'confirmed',
      },
    ],
  };

  const fakeRiskDashboard = {
    risk_summary: { alto: 1, medio: 2, bajo: 1, sin_riesgo: 4 },
    clients_by_risk: [
      {
        id: 1,
        customer_id: 1,
        customer_name: 'María López',
        avatar_url: null,
        level: 'alto',
        computed_at: new Date().toISOString(),
        kore_score: 62,
        signals_count: 2,
        behavioral_signals: [
          { type: 'low_adherence', label: 'Adherencia baja', severity: 'alto', detail: 'Adherencia 30% últimos 7 días', since_date: new Date(Date.now() - 5 * 86400000).toISOString() },
        ],
        clinical_signals: [],
        resolutions: [],
      },
    ],
  };

  const fakeComparativeMetrics = {
    adherence_ranking: [],
    improved_this_week: [],
    worsened_this_week: [],
    global_patterns: { avg_training_adherence: 0.74, avg_nutrition_adherence: 0.7, most_missed_day_of_week: 'monday' },
    expired_evaluations: [
      { customer_id: 3, name: 'Laura Ríos', module: 'anthropometry', module_label: 'Antropometría', days_since: 75, urgency: 'high' },
    ],
  };

  async function setupDashboardMocks(
    page: import('@playwright/test').Page,
    opts: { stats?: typeof fakeStats; risk?: typeof fakeRiskDashboard; comparative?: typeof fakeComparativeMetrics } = {},
  ) {
    const stats = opts.stats ?? fakeStats;
    const risk = opts.risk ?? fakeRiskDashboard;
    const comparative = opts.comparative ?? fakeComparativeMetrics;
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stats) });
    });
    await page.route('**/api/trainer/risk-dashboard/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(risk) });
    });
    await page.route('**/api/trainer/comparative-metrics/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(comparative) });
    });
    // La card de agenda (vista Día) pide /trainer/agenda/?from=&to=.
    await page.route(/\/api\/trainer\/agenda\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: stats.upcoming_sessions }),
      });
    });
  }

  test('renders greeting with trainer first name', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Germán', { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Buenos días|Buenas tardes|Buenas noches/);
  });

  test('renders sessions-today summary in the greeting hero', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByText(/3 sesiones/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/programadas/i).first()).toBeVisible();
  });

  test('renders quick action link to clients page', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    const quickAction = page.getByRole('link', { name: 'Ver clientes' });
    await expect(quickAction).toBeVisible({ timeout: 15_000 });
    await expect(quickAction).toHaveAttribute('href', '/trainer/clients');
  });

  test('renders todays agenda with client names', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByText('Agenda', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('María López').first()).toBeVisible();
    await expect(page.getByText('Carlos Gómez')).toBeVisible();
  });

  test('agenda rows show the package title', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page);
    await page.goto('/trainer/dashboard');

    await expect(page.getByText('María López').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plan Elite')).toBeVisible();
    await expect(page.getByText('Plan Pro')).toBeVisible();
  });

  test('empty agenda shows zero sessions programmed', async ({ page }) => {
    const emptyStats = { total_clients: 0, today_sessions: 0, upcoming_sessions: [] };
    const emptyRisk = { risk_summary: { alto: 0, medio: 0, bajo: 0, sin_riesgo: 0 }, clients_by_risk: [] };
    const emptyComparative = { ...fakeComparativeMetrics, expired_evaluations: [] };
    await injectTrainerAuthCookies(page);
    await setupDashboardMocks(page, { stats: emptyStats, risk: emptyRisk, comparative: emptyComparative });
    await page.goto('/trainer/dashboard');

    await expect(page.getByText('Agenda', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Sin sesiones programadas hoy.')).toBeVisible();
    await expect(page.getByText('Sin clientes activos')).toBeVisible();
  });
});
