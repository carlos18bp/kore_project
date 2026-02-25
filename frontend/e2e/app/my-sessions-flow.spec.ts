import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('My Programs Flow — Program Detail & Session Detail (mocked)', { tag: [...FlowTags.MY_PROGRAMS_DETAIL, RoleTags.USER] }, () => {
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
    const cookieUser = encodeURIComponent(JSON.stringify({ id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer', name: 'Usuario Prueba' }));
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-jwt-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: cookieUser, domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer' } }) }));
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/subscriptions/expiry-reminder/**', (r) => r.fulfill({ status: 204 }));
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/expiry-reminder') || url.includes('/cancel') || url.includes('/payments')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [navMockSub] }) });
    });
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
        return;
      }
      if (url.includes('/cancel') || url.includes('/reschedule')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: bookings.length, next: null, previous: null, results: bookings }) });
    });
  }

  test('clicking a subscription card navigates to program detail', async ({ page }) => {
    await setupListAndDetailMocks(page, []);
    await page.goto('/my-programs');
    await expect(page.getByText('Paquete Navegación')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: /Paquete Navegación/ }).click();
    await page.waitForURL(`**/my-programs/program/${navSubId}`);

    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Mis Programas' })).toBeVisible();
    await expect(main.getByText('Restantes')).toBeVisible();
    await expect(main.getByText('Total')).toBeVisible();
    await expect(main.getByText('Vencimiento')).toBeVisible();
    await expect(main.getByText('Usadas')).toBeVisible();
  });

  test('program detail page renders upcoming/past tabs', async ({ page }) => {
    const pastSlotStart = new Date(Date.now() - 3 * 86400000).toISOString();
    const pastSlotEnd = new Date(Date.now() - 3 * 86400000 + 3600000).toISOString();
    const pastBk = { id: 310, status: 'confirmed', slot: { id: 410, starts_at: pastSlotStart, ends_at: pastSlotEnd }, trainer: null, package: { title: 'Paquete Navegación' } };
    await setupListAndDetailMocks(page, [pastBk]);
    await page.goto(`/my-programs/program/${navSubId}`);

    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Próximas' })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByRole('button', { name: 'Pasadas' })).toBeVisible();

    await main.getByRole('button', { name: 'Pasadas' }).click();
    await expect(main.getByText('Confirmada')).toBeVisible({ timeout: 5_000 });

    await main.getByRole('button', { name: 'Próximas' }).click();
    await expect(main.getByText('No tienes sesiones próximas.')).toBeVisible();
  });

  test('program detail shows empty state for upcoming when no bookings', async ({ page }) => {
    await setupListAndDetailMocks(page, []);
    await page.goto(`/my-programs/program/${navSubId}`);

    const main = page.getByRole('main');
    await expect(main.getByText('No tienes sesiones próximas.')).toBeVisible({ timeout: 10_000 });

    const link = main.getByRole('link', { name: 'Agendar sesión' });
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain(`subscription=${navSubId}`);
  });

  test('breadcrumb navigates back to my-programs', async ({ page }) => {
    await setupListAndDetailMocks(page, []);
    await page.goto(`/my-programs/program/${navSubId}`);

    const main = page.getByRole('main');
    await expect(main.getByText('Paquete Navegación').first()).toBeVisible({ timeout: 10_000 });

    await main.getByRole('link', { name: 'Mis Programas' }).click();
    await page.waitForURL('**/my-programs');
    await expect(page.getByRole('heading', { name: 'Mis Programas' })).toBeVisible();
  });
});

test.describe('Program Detail Page — mocked data branches', { tag: [...FlowTags.MY_PROGRAMS_DETAIL, RoleTags.USER] }, () => {
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
    status: 'confirmed',
    slot: { id: 401, starts_at: futureSlotStart, ends_at: futureSlotEnd },
    trainer: { first_name: 'Germán', last_name: 'Franco' },
    package: { title: 'Paquete Elite' },
  };

  const pastBooking = {
    id: 302,
    status: 'confirmed',
    slot: { id: 402, starts_at: pastSlotStart, ends_at: pastSlotEnd },
    trainer: null,
    package: { title: 'Paquete Elite' },
  };

  const canceledBooking = {
    id: 303,
    status: 'canceled',
    slot: { id: 403, starts_at: futureSlotStart, ends_at: futureSlotEnd },
    trainer: { first_name: 'Germán', last_name: 'Franco' },
    package: { title: 'Paquete Elite' },
  };

  async function setupProgramDetailMocks(
    page: import('@playwright/test').Page,
    bookings: typeof upcomingBooking[],
    count = bookings.length,
  ) {
    const cookieUser = encodeURIComponent(JSON.stringify({ id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer', name: 'Usuario Prueba' }));
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-jwt-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: cookieUser, domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer' } }) }));
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/subscriptions/expiry-reminder/**', (r) => r.fulfill({ status: 204 }));
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/expiry-reminder') || url.includes('/cancel') || url.includes('/payments')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSub] }) });
    });
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder') || url.includes('/cancel') || url.includes('/reschedule')) { await route.fallback(); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count, next: null, previous: null, results: bookings }) });
    });
  }

  test('program detail renders header card with subscription data', async ({ page }) => {
    await setupProgramDetailMocks(page, [upcomingBooking]);
    await page.goto(`/my-programs/program/${subId}`);
    const main = page.getByRole('main');
    await expect(main.getByText('Paquete Elite').first()).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Restantes')).toBeVisible();
    await expect(main.getByText('Usadas')).toBeVisible();
    await expect(main.getByText('Activo')).toBeVisible();
  });

  test('upcoming tab shows future confirmed bookings with trainer name', async ({ page }) => {
    await setupProgramDetailMocks(page, [upcomingBooking]);
    await page.goto(`/my-programs/program/${subId}`);
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Pr\u00f3ximas' })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Confirmada')).toBeVisible();
    await expect(main.getByText(/Germ\u00e1n Franco/)).toBeVisible();
  });

  test('past tab shows past bookings and empty upcoming state', async ({ page }) => {
    await setupProgramDetailMocks(page, [pastBooking]);
    await page.goto(`/my-programs/program/${subId}`);
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Pr\u00f3ximas' })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('No tienes sesiones pr\u00f3ximas.')).toBeVisible();
    await main.getByRole('button', { name: 'Pasadas' }).click();
    await expect(main.getByText('Confirmada')).toBeVisible();
  });

  test('canceled booking appears in past tab even with future slot', async ({ page }) => {
    await setupProgramDetailMocks(page, [canceledBooking]);
    await page.goto(`/my-programs/program/${subId}`);
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Pasadas' })).toBeVisible({ timeout: 10_000 });
    await main.getByRole('button', { name: 'Pasadas' }).click();
    await expect(main.getByText('Cancelada')).toBeVisible();
  });

  test('pagination controls render when totalPages greater than 1', async ({ page }) => {
    await setupProgramDetailMocks(page, [upcomingBooking], 25);
    await page.goto(`/my-programs/program/${subId}`);
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Siguiente' })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText(/P\u00e1gina 1 de/)).toBeVisible();
    await expect(main.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });
});
