import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Client Detail page (/trainer/clients/client?id=X).
 * Covers the redesigned tab-based layout: Resumen, Programa, Alertas, Antropometría,
 * Posturometría, Ev. Física, Notas tabs; plus client header and fallback stats.
 */
test.describe('Trainer Client Detail Page', { tag: [...FlowTags.TRAINER_CLIENT_DETAIL, RoleTags.TRAINER] }, () => {

  const fakeClient = {
    id: 1,
    first_name: 'María',
    last_name: 'López',
    email: 'maria@example.com',
    phone: '3009876543',
    avatar_url: null,
    profile: {
      sex: 'femenino',
      date_of_birth: '1992-03-20',
      city: 'Medellín',
      eps: 'Compensar',
      primary_goal: 'fat_loss',
      address: 'Carrera 50 #10-15',
      id_type: 'cc',
      id_number: '9876543210',
      kore_start_date: '2025-08-15',
    },
    subscription: {
      package_title: 'Plan Elite',
      package_price: '300000',
      package_currency: 'COP',
      sessions_total: 10,
      sessions_used: 4,
      sessions_remaining: 6,
      starts_at: '2025-10-01',
      expires_at: '2026-01-01',
      is_recurring: false,
      next_billing_date: null,
    },
    last_payment: {
      amount: '300000',
      currency: 'COP',
      created_at: '2025-10-01',
    },
    next_session: null,
    stats: {
      completed: 4,
      pending: 2,
      canceled: 1,
      total: 7,
    },
  };

  const fakeSessions = [
    { id: 101, status: 'confirmed', starts_at: '2025-12-01T10:00:00Z', package_title: 'Plan Elite' },
    { id: 102, status: 'confirmed', starts_at: '2025-12-05T14:00:00Z', package_title: 'Plan Elite' },
    { id: 103, status: 'canceled', starts_at: '2025-12-03T09:00:00Z', package_title: 'Plan Elite' },
    { id: 104, status: 'pending', starts_at: new Date(Date.now() + 2 * 86400000).toISOString(), package_title: 'Plan Elite' },
  ];

  async function setupClientDetailMocks(page: import('@playwright/test').Page, client = fakeClient, sessions = fakeSessions) {
    await page.route('**/api/trainer/my-clients/1/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(client),
      });
    });
    await page.route('**/api/trainer/my-clients/1/sessions/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessions),
      });
    });
    await page.route('**/api/trainer/my-clients/1/kpi/', async (route) => {
      // 404 triggers the fallback stats view (no clinical KPI data)
      await route.fulfill({ status: 404, body: '' });
    });
    await page.route('**/api/trainer/my-clients/1/sessions-full/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessions),
      });
    });
    await page.route('**/api/trainer/my-clients/1/alerts/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
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

  test('renders client name in heading and back link', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Volver a clientes' })).toBeVisible();
  });

  test('renders tab navigation', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    // Tab bar with key tabs always visible
    await expect(page.getByRole('button', { name: 'Resumen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Programa' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alertas' })).toBeVisible();
  });

  test('Resumen tab shows stats fallback when no clinical data', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    // When KPI endpoint returns 404, fallback card shows session stats
    await expect(page.getByText('Completadas').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Pendientes').filter({ visible: true }).first()).toBeVisible();
  });

  test('Resumen tab shows next session when available', async ({ page }) => {
    const withNextSession = {
      ...fakeClient,
      next_session: {
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        package_title: 'Plan Elite',
      } as never,
    };
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page, withNextSession);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Próxima sesión').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Plan Elite').first()).toBeVisible();
  });

  test('renders no subscription placeholder when client has no subscription', async ({ page }) => {
    const noSubClient = { ...fakeClient, subscription: null as never, last_payment: null as never };
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page, noSubClient);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    // Stats card still shows (client.stats) — subscription section just lacks plan data
    await expect(page.getByText('Completadas').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('renders eval tabs in tab bar', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    // Evaluation modules are now tabs, not links
    await expect(page.getByRole('button', { name: 'Antropometría' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Posturometría' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ev. Física' })).toBeVisible();
  });

  test('switching to Notas tab renders notes section', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    // Add mock for trainer messages endpoint
    await page.route('**/api/trainer/messages/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Notas' }).click();
    // Notes tab content loads — empty state or note list
    await expect(page.getByText(/nota|mensaje|Sin notas/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('empty session history shows stats with zero completed', async ({ page }) => {
    const emptyStats = { ...fakeClient, stats: { completed: 0, pending: 0, canceled: 0, total: 0 } };
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page, emptyStats, []);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Completadas').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('next session badge renders when client has upcoming session', async ({ page }) => {
    const withNextSession = {
      ...fakeClient,
      next_session: {
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        package_title: 'Plan Elite',
      } as never,
    };
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page, withNextSession);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByText('Próxima sesión').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plan Elite').first()).toBeVisible();
  });
});
