import { test, expect, setupDefaultApiMocks, injectAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('My Programs Flow — Subscription detail & sessions (mocked)', { tag: [...FlowTags.MY_PROGRAMS_DETAIL, RoleTags.USER] }, () => {
  const navSubId = 55;
  const navMockSub = {
    id: navSubId,
    customer_email: 'e2e@kore.com',
    package: { id: 7, title: 'Paquete Navegación', sessions_count: 6, session_duration_minutes: 60, price: '180000', currency: 'COP', validity_days: 45 },
    sessions_total: 6,
    sessions_used: 2,
    sessions_remaining: 4,
    status: 'active',
    starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 40 * 86400000).toISOString(),
    next_billing_date: null,
  };

  async function setupListAndDetailMocks(
    page: import('@playwright/test').Page,
    bookings: Record<string, unknown>[] = [],
  ) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);

    await page.route('**/api/subscriptions/', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [navMockSub] }),
    }));
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder') || url.includes('/cancel') || url.includes('/reschedule')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: bookings.length, next: null, previous: null, results: bookings }) });
    });
  }

  test('clicking a subscription card shows details section', async ({ page }) => {
    await setupListAndDetailMocks(page, []);
    await page.goto('/subscription');
    await expect(page.getByText('Paquete Navegación').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Paquete Navegación/ }).click();

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Detalles' })).toBeVisible();
    await expect(main.getByText('2 de 6 completadas').first()).toBeVisible();
    await expect(main.getByText('Vence:')).toBeVisible();
    await expect(main.getByText('Avance:')).toBeVisible();
  });

  test('subscription page renders upcoming past tabs', async ({ page }) => {
    const pastSlotStart = new Date(Date.now() - 3 * 86400000).toISOString();
    const pastSlotEnd = new Date(Date.now() - 3 * 86400000 + 3600000).toISOString();
    const pastBk = {
      id: 310,
      subscription_id_display: navSubId,
      status: 'confirmed',
      slot: { id: 410, starts_at: pastSlotStart, ends_at: pastSlotEnd },
      trainer: null,
      package: { title: 'Paquete Navegación' },
    };
    await setupListAndDetailMocks(page, [pastBk]);
    await page.goto('/subscription');

    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Próximas' })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByRole('button', { name: 'Pasadas' })).toBeVisible();

    await main.getByRole('button', { name: 'Pasadas' }).click();
    await expect(main.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 5_000 });

    await main.getByRole('button', { name: 'Próximas' }).click();
    await expect(main.getByText('No tienes sesiones próximas')).toBeVisible();
  });

  test('subscription shows empty state for upcoming when no bookings', async ({ page }) => {
    await setupListAndDetailMocks(page, []);
    await page.goto('/subscription');

    const main = page.getByRole('main');
    await expect(main.getByText('No tienes sesiones próximas')).toBeVisible({ timeout: 10_000 });

    const link = main.getByRole('link', { name: 'Agendar' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/book-session');
  });

  test('navigate from subscription to dashboard and back via sidebar', async ({ page }) => {
    await setupListAndDetailMocks(page, []);
    await page.goto('/subscription');
    await expect(page.getByRole('heading', { name: 'Mi Suscripción' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: 'Inicio' }).click();
    await page.waitForURL('**/dashboard');
    await page.getByRole('link', { name: 'Mi Suscripción' }).click();
    await page.waitForURL('**/subscription');
    await expect(page.getByRole('heading', { name: 'Mi Suscripción' })).toBeVisible();
  });
});

test.describe('Subscription detail — mocked data branches', { tag: [...FlowTags.MY_PROGRAMS_DETAIL, RoleTags.USER] }, () => {
  const subId = 42;
  const mockSub = {
    id: subId,
    customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Paquete Elite', sessions_count: 10, session_duration_minutes: 60, price: '300000', currency: 'COP', validity_days: 90 },
    sessions_total: 10,
    sessions_used: 4,
    sessions_remaining: 6,
    status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 80 * 86400000).toISOString(),
    next_billing_date: null,
  };

  const futureSlotStart = new Date(Date.now() + 2 * 86400000).toISOString();
  const futureSlotEnd = new Date(Date.now() + 2 * 86400000 + 3600000).toISOString();
  const pastSlotStart = new Date(Date.now() - 3 * 86400000).toISOString();
  const pastSlotEnd = new Date(Date.now() - 3 * 86400000 + 3600000).toISOString();

  const upcomingBooking = {
    id: 301,
    subscription_id_display: subId,
    status: 'confirmed',
    slot: { id: 401, starts_at: futureSlotStart, ends_at: futureSlotEnd },
    trainer: { first_name: 'Germán', last_name: 'Franco' },
    package: { title: 'Paquete Elite' },
  };

  const pastBooking = {
    id: 302,
    subscription_id_display: subId,
    status: 'confirmed',
    slot: { id: 402, starts_at: pastSlotStart, ends_at: pastSlotEnd },
    trainer: null,
    package: { title: 'Paquete Elite' },
  };

  const canceledBooking = {
    id: 303,
    subscription_id_display: subId,
    status: 'canceled',
    slot: { id: 403, starts_at: futureSlotStart, ends_at: futureSlotEnd },
    trainer: { first_name: 'Germán', last_name: 'Franco' },
    package: { title: 'Paquete Elite' },
  };

  async function setupProgramDetailMocks(
    page: import('@playwright/test').Page,
    bookings: typeof upcomingBooking[],
  ) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);

    await page.route('**/api/subscriptions/', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSub] }),
    }));
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder') || url.includes('/cancel') || url.includes('/reschedule')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: bookings.length, next: null, previous: null, results: bookings }) });
    });
  }

  test('subscription detail renders card with subscription data', async ({ page }) => {
    await setupProgramDetailMocks(page, [upcomingBooking]);
    await page.goto('/subscription');
    const main = page.getByRole('main');
    await expect(main.getByText('Paquete Elite').first()).toBeVisible({ timeout: 10_000 });
    await expect(main.getByRole('heading', { name: 'Detalles' })).toBeVisible();
    await expect(main.getByText('Avance:')).toBeVisible();
    await expect(main.locator('span').filter({ hasText: /^Activa$/ }).first()).toBeVisible();
  });

  test('upcoming tab shows future confirmed bookings with trainer name', async ({ page }) => {
    await setupProgramDetailMocks(page, [upcomingBooking]);
    await page.goto('/subscription');
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Próximas' })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByRole('button', { name: /Confirmada/ })).toBeVisible();
    await expect(main.getByText(/Germán Franco/)).toBeVisible();
  });

  test('past tab shows past bookings and empty upcoming state', async ({ page }) => {
    await setupProgramDetailMocks(page, [pastBooking]);
    await page.goto('/subscription');
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Próximas' })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('No tienes sesiones próximas')).toBeVisible();
    await main.getByRole('button', { name: 'Pasadas' }).click();
    await expect(main.getByRole('button', { name: /Confirmada/ })).toBeVisible();
  });

  test('canceled booking appears in past tab even with future slot', async ({ page }) => {
    await setupProgramDetailMocks(page, [canceledBooking]);
    await page.goto('/subscription');
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Pasadas' })).toBeVisible({ timeout: 10_000 });
    await main.getByRole('button', { name: 'Pasadas' }).click();
    await expect(main.getByRole('button', { name: /Cancelada/ })).toBeVisible();
  });

  test('shows more-sessions hint when list exceeds five', async ({ page }) => {
    const bookings = Array.from({ length: 6 }, (_, i) => ({
      id: 400 + i,
      subscription_id_display: subId,
      status: 'confirmed' as const,
      slot: {
        id: 500 + i,
        starts_at: new Date(Date.now() + (2 + i) * 86400000).toISOString(),
        ends_at: new Date(Date.now() + (2 + i) * 86400000 + 3600000).toISOString(),
      },
      trainer: { first_name: 'G', last_name: 'F' },
      package: { title: 'Paquete Elite' },
    }));
    await setupProgramDetailMocks(page, bookings);
    await page.goto('/subscription');
    const main = page.getByRole('main');
    await expect(main.getByText('1 sesiones más')).toBeVisible({ timeout: 10_000 });
  });
});
