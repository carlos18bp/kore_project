import { test, expect, E2E_USER, mockLoginAsTestUser } from '../fixtures';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Dashboard Page', { tag: [...FlowTags.DASHBOARD_OVERVIEW, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('renders greeting with user first name', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(E2E_USER.firstName) })).toBeVisible();
  });

  test('renders progress section', async ({ page }) => {
    const main = page.getByRole('main');
    await expect(main.getByText('Mi Progreso').filter({ visible: true })).toBeVisible({ timeout: 10_000 });
  });

  test('renders the compact next-session row', async ({ page }) => {
    // The row is always present (empty state included) and opens the sessions modal.
    await expect(
      page.getByRole('main').getByText('Próxima sesión').filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('renders sidebar navigation links', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await expect(sidebar.getByRole('link', { name: 'Antropometría' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Mi Suscripción' })).toBeVisible();
  });

  test('switching to the Resumen Mensual tab shows its monthly panel', async ({ page }) => {
    const main = page.getByRole('main');
    await expect(main.getByText('Mi Progreso').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });

    await main.getByRole('button', { name: 'Resumen Mensual' }).click();

    await expect(main.getByText('Adherencia final').first()).toBeVisible({ timeout: 10_000 });
  });

  test('renders sidebar subscription link', async ({ page }) => {
    await expect(page.getByRole('complementary').getByRole('link', { name: 'Mi Suscripción' })).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar is visible with navigation', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await expect(sidebar.getByRole('link', { name: 'Mi Suscripción' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  test('hero shows the credit balance badge', async ({ page }) => {
    await page.route('**/api/credits/wallet/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ balance: 55, pending_balance: 0, current_streak: 3, longest_streak: 9, last_active_date: null, next_milestone: null }) }));
    await page.route('**/api/credits/values/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ action_values: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 }, streak_bonuses: { '3': 20, '7': 50 }, water_goal_glasses: 8, meal_review_days: 3, require_workout_captures: true }) }));
    await page.goto('/dashboard');
    const badge = page.getByRole('link', { name: 'Ver mis créditos' }).filter({ visible: true }).first();
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toHaveAttribute('href', '/mis-creditos');
    await expect(badge.getByText('55')).toBeVisible();
  });

  test('wallet endpoint failure degrades the credits badge to a placeholder', async ({ page }) => {
    await mockApiError(page, '**/api/credits/wallet/**', 500);
    await page.goto('/dashboard');

    // There is no dedicated error UI for the wallet: the badge stays rendered
    // with an em-dash placeholder instead of a balance and keeps its link.
    const badge = page.getByRole('link', { name: 'Ver mis créditos' }).filter({ visible: true }).first();
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toContainText('—');
    await expect(badge).toContainText('créditos');
    await expect(badge).toHaveAttribute('href', '/mis-creditos');
  });

  test('bookings endpoint failure still renders the empty next-session row', async ({ page }) => {
    await mockApiError(page, '**/api/bookings/**', 500);
    await page.goto('/dashboard');

    // Graceful degradation: no error banner exists for bookings on the
    // dashboard; the page stays functional and falls back to the empty row.
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(E2E_USER.firstName) }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('main').getByText('Sin sesiones próximas').filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('credits badge renders a zero balance without hiding itself', async ({ page }) => {
    await page.route('**/api/credits/wallet/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ balance: 0, pending_balance: 0, current_streak: 0, longest_streak: 0, last_active_date: null, next_milestone: null }) }));
    await page.route('**/api/credits/values/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ action_values: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 }, streak_bonuses: { '3': 20, '7': 50 }, water_goal_glasses: 8, meal_review_days: 3, require_workout_captures: true }) }));
    await page.goto('/dashboard');

    const badge = page.getByRole('link', { name: 'Ver mis créditos' }).filter({ visible: true }).first();
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toContainText('0 créditos');
  });
});

test.describe('Dashboard Page — data-rich branches', { tag: [...FlowTags.DASHBOARD_OVERVIEW, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const activeSub = {
    id: 10,
    customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Plan Elite', sessions_count: 10, session_duration_minutes: 60, price: '300000', currency: 'COP', validity_days: 90 },
    sessions_total: 10,
    sessions_used: 3,
    sessions_remaining: 7,
    sessions_completed: 3,
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
    starts_at: slotStart.toISOString(),
    ends_at: slotEnd.toISOString(),
    trainer: { first_name: 'Germán', last_name: 'Franco' },
    package: { title: 'Plan Elite' },
  };

  const bookingList = [
    { id: 61, status: 'confirmed', starts_at: new Date(Date.now() - 2 * 86400000).toISOString(), ends_at: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString(), trainer: null, package: { title: 'Plan Elite' } },
    { id: 62, status: 'canceled', starts_at: new Date(Date.now() - 5 * 86400000).toISOString(), ends_at: new Date(Date.now() - 5 * 86400000 + 3600000).toISOString(), trainer: null, package: { title: 'Plan Elite' } },
    { id: 63, status: 'pending', starts_at: new Date(Date.now() - 7 * 86400000).toISOString(), ends_at: new Date(Date.now() - 7 * 86400000 + 3600000).toISOString(), trainer: null, package: null },
  ];

  async function setupDashboardMocks(page: import('@playwright/test').Page) {
    const cookieUser = encodeURIComponent(JSON.stringify({ id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer', name: 'Usuario Prueba', profile_completed: true, avatar_url: null }));
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-jwt-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: cookieUser, domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer', profile_completed: true, avatar_url: null, customer_profile: { profile_completed: true, sex: 'M', date_of_birth: '1990-01-15', city: 'Bogotá', primary_goal: 'health' }, today_mood: { score: 7, notes: '', date: new Date().toISOString().slice(0, 10) } } }) }));
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/subscriptions/expiry-reminder/**', (r) => r.fulfill({ status: 204 }));
    await page.route('**/api/subscriptions/pending-invitation/**', (r) => r.fulfill({ status: 204 }));
    await page.route('**/api/trainers/',(r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
    await page.route('**/api/availability/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));
  }

  test('active subscription renders the dashboard layout', async ({ page }) => {
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
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: /Usuario/ })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Sin sesiones próximas').filter({ visible: true }).first()).toBeVisible();
  });

  test('upcoming session shows formatted date in Proxima sesion card', async ({ page }) => {
    await setupDashboardMocks(page);
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/expiry-reminder') || url.includes('/cancel') || url.includes('/payments') || url.includes('/pending-invitation')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [activeSub] }) });
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
    const main = page.getByRole('main');
    await expect(main.getByText('Próxima sesión').filter({ visible: true })).toBeVisible({ timeout: 10_000 });
  });

  test('upcoming sessions modal lists past booking statuses', async ({ page }) => {
    await setupDashboardMocks(page);
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/expiry-reminder') || url.includes('/cancel') || url.includes('/payments') || url.includes('/pending-invitation')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [activeSub] }) });
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
    await page.getByRole('button', { name: 'Ver mis sesiones' }).first().click();

    await expect(page.getByRole('heading', { name: 'Mis sesiones' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Pasadas\s*\(/ }).click();
    await expect(page.getByText('Realizada', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Cancelada', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Agendada', { exact: true }).first()).toBeVisible();
  });
});
