import { test, expect, E2E_USER, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Dashboard Page', { tag: [...FlowTags.DASHBOARD_OVERVIEW, RoleTags.USER] }, () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page);
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('renders greeting with user first name', async ({ page }) => {
    await expect(page.getByText(`Hola, ${E2E_USER.firstName}`)).toBeVisible();
  });

  test('renders program info card', async ({ page }) => {
    await expect(page.getByText('Tu programa', { exact: true })).toBeVisible();
    // Dashboard currently shows hardcoded placeholder
    await expect(page.getByText('Sin programa activo').first()).toBeVisible();
  });

  test('renders sessions remaining', async ({ page }) => {
    await expect(page.getByText('Sesiones restantes')).toBeVisible();
  });

  test('renders next session card', async ({ page }) => {
    await expect(page.getByText('Próxima sesión')).toBeVisible();
  });

  test('renders quick action buttons', async ({ page }) => {
    await expect(page.getByText('Acciones rápidas')).toBeVisible();
    const main = page.locator('main');
    await expect(main.getByRole('link', { name: /Agendar sesión/i })).toBeVisible();
    await expect(main.getByRole('link', { name: /Mi suscripción/i })).toBeVisible();
    await expect(main.getByRole('link', { name: /Mis programas/i })).toBeVisible();
  });

  test('renders recent activity section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Actividad reciente' })).toBeVisible();
  });

  test('renders user profile card', async ({ page }) => {
    await expect(page.getByText('Tu perfil')).toBeVisible();
    await expect(page.getByText(E2E_USER.fullName).first()).toBeVisible();
  });

  test('sidebar is visible with navigation', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Agendar Sesión' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Mis Programas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });
});

test.describe('Dashboard Page — data-rich branches', { tag: [...FlowTags.DASHBOARD_OVERVIEW, RoleTags.USER] }, () => {
  const activeSub = {
    id: 10,
    customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Plan Elite', sessions_count: 10, session_duration_minutes: 60, price: '300000', currency: 'COP', validity_days: 90 },
    sessions_total: 10,
    sessions_used: 3,
    sessions_remaining: 7,
    status: 'active',
    starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 85 * 86400000).toISOString(),
    next_billing_date: null,
  };

  const slotStart = new Date(Date.now() + 20 * 3600000);
  const slotEnd = new Date(slotStart.getTime() + 3600000);

  const upcomingBooking = {
    id: 55,
    subscription_id_display: 10,
    status: 'confirmed',
    slot: { id: 200, starts_at: slotStart.toISOString(), ends_at: slotEnd.toISOString() },
    trainer: { first_name: 'Germán', last_name: 'Franco' },
    package: { title: 'Plan Elite' },
  };

  const bookingList = [
    { id: 61, status: 'confirmed', slot: { id: 201, starts_at: new Date(Date.now() - 2 * 86400000).toISOString(), ends_at: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString() }, package: { title: 'Plan Elite' } },
    { id: 62, status: 'canceled', slot: { id: 202, starts_at: new Date(Date.now() - 5 * 86400000).toISOString(), ends_at: new Date(Date.now() - 5 * 86400000 + 3600000).toISOString() }, package: { title: 'Plan Elite' } },
    { id: 63, status: 'pending', slot: { id: 203, starts_at: new Date(Date.now() - 7 * 86400000).toISOString(), ends_at: new Date(Date.now() - 7 * 86400000 + 3600000).toISOString() }, package: null },
  ];

  async function setupDashboardMocks(page: import('@playwright/test').Page) {
    const cookieUser = encodeURIComponent(JSON.stringify({ id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer', name: 'Usuario Prueba' }));
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-jwt-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: cookieUser, domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer' } }) }));
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/subscriptions/expiry-reminder/**', (r) => r.fulfill({ status: 204 }));
    await page.route('**/api/trainers/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
    await page.route('**/api/availability-slots/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
  }

  test('active subscription shows program name and sessions count', async ({ page }) => {
    await setupDashboardMocks(page);
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/expiry-reminder') || url.includes('/cancel') || url.includes('/payments')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [activeSub] }) });
    });
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder') || url.includes('/cancel') || url.includes('/reschedule')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });

    await page.goto('/dashboard');
    const main = page.locator('main');
    await expect(main.getByText('Plan Elite').first()).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('de 10', { exact: true })).toBeVisible();
    await expect(main.getByText('Sesiones restantes')).toBeVisible();
  });

  test('upcoming session shows formatted date in Proxima sesion card', async ({ page }) => {
    await setupDashboardMocks(page);
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/expiry-reminder') || url.includes('/cancel') || url.includes('/payments')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/cancel') || url.includes('/reschedule')) { await route.fallback(); return; }
      if (url.includes('/upcoming-reminder')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(upcomingBooking) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });

    await page.goto('/dashboard');
    const main = page.locator('main');
    await expect(main.getByText('Pr\u00f3xima sesi\u00f3n')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Sin agendar')).not.toBeVisible({ timeout: 10_000 });
  });

  test('recent activity shows confirmed, canceled and pending booking statuses', async ({ page }) => {
    await setupDashboardMocks(page);
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/expiry-reminder') || url.includes('/cancel') || url.includes('/payments')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/cancel') || url.includes('/reschedule')) { await route.fallback(); return; }
      if (url.includes('/upcoming-reminder')) {
        await route.fulfill({ status: 204 });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 3, next: null, previous: null, results: bookingList }) });
    });

    await page.goto('/dashboard');
    const main = page.locator('main');
    await expect(main.getByText('Sesi\u00f3n confirmada').first()).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Sesi\u00f3n cancelada')).toBeVisible();
    await expect(main.getByText('Sesi\u00f3n pendiente')).toBeVisible();
    await expect(main.getByText('No hay actividad reciente')).not.toBeVisible();
  });
});
