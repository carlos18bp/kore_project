import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Client Detail page (/trainer/clients/client?id=X).
 * Covers client profile, session history, stats, module links, and edge cases.
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

  test('renders personal info card with contact details', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    const infoHeading = page.getByRole('heading', { name: 'Información personal' });
    await expect(infoHeading).toBeVisible({ timeout: 15_000 });
    const infoCard = infoHeading.locator('..');
    await expect(infoCard.getByText('María López')).toBeVisible();
    await expect(infoCard.getByText('maria@example.com')).toBeVisible();
    await expect(infoCard.getByText('3009876543')).toBeVisible();
    await expect(infoCard.getByText('Femenino')).toBeVisible();
  });

  test('renders personal info card with health profile details', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    const infoHeading = page.getByRole('heading', { name: 'Información personal' });
    await expect(infoHeading).toBeVisible({ timeout: 15_000 });
    const infoCard = infoHeading.locator('..');
    await expect(infoCard.getByText('Medellín')).toBeVisible();
    await expect(infoCard.getByText('Compensar')).toBeVisible();
    await expect(infoCard.getByText('Perder grasa')).toBeVisible();
  });

  test('renders subscription and payment card', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { name: 'Suscripción y pago' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plan Elite').first()).toBeVisible();
    await expect(page.getByText('4 de 10 completadas')).toBeVisible();
    await expect(page.getByText('6 sesiones')).toBeVisible();
  });

  test('renders no subscription placeholder when client has no subscription', async ({ page }) => {
    const noSubClient = { ...fakeClient, subscription: null as never, last_payment: null as never };
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page, noSubClient);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { name: 'Información personal' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Este cliente no tiene una suscripción activa.')).toBeVisible();
  });

  test('renders stats card with completed, pending, and canceled counts', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    const statsHeading = page.getByRole('heading', { name: 'Resumen' });
    await expect(statsHeading).toBeVisible({ timeout: 15_000 });
    const statsCard = statsHeading.locator('..');
    await expect(statsCard.getByText('Sesiones completadas')).toBeVisible();
    await expect(statsCard.getByText('Sesiones pendientes')).toBeVisible();
    await expect(statsCard.getByText('Sesiones canceladas')).toBeVisible();
  });

  test('renders module links for assessments', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { name: 'Módulos' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Antropometría' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Posturometría' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Evaluación Física' })).toBeVisible();
  });

  test('renders completed session history', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { name: 'Sesiones completadas' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Completada').first()).toBeVisible();
  });

  test('renders upcoming sessions section', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { name: 'Próximas sesiones' })).toBeVisible({ timeout: 15_000 });
  });

  test('empty session history shows placeholder', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page, fakeClient, []);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { name: 'Sesiones completadas' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Sin sesiones completadas.')).toBeVisible();
    await expect(page.getByText('Sin sesiones próximas agendadas.')).toBeVisible();
  });

  test('client avatar shows first letter initial when no avatar', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientDetailMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    const profileCard = page.getByRole('heading', { name: 'Información personal' }).locator('..');
    await expect(profileCard.locator('span').filter({ hasText: /^M$/ })).toBeVisible();
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
