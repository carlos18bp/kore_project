import { test, expect, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Subscription page (/subscription).
 * Uses mocked API responses to exercise subscriptionStore actions
 * (cancel, fetchPaymentHistory) and the full page UI.
 */
test.describe('Subscription Page (mocked)', { tag: [...FlowTags.SUBSCRIPTION_PAGE, RoleTags.USER] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page);
    await expect(page).toHaveURL('about:blank');
  });

  const mockSubscription: {
    id: number;
    customer_email: string;
    package: { id: number; title: string; sessions_count: number; session_duration_minutes: number; price: string; currency: string; validity_days: number };
    sessions_total: number;
    sessions_used: number;
    sessions_remaining: number;
    status: string;
    starts_at: string;
    expires_at: string;
    next_billing_date: string | null;
  } = {
    id: 20,
    customer_email: 'e2e@kore.com',
    package: {
      id: 6,
      title: 'Paquete Pro',
      sessions_count: 8,
      session_duration_minutes: 60,
      price: '240000',
      currency: 'COP',
      validity_days: 60,
    },
    sessions_total: 8,
    sessions_used: 3,
    sessions_remaining: 5,
    status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
    next_billing_date: new Date(Date.now() + 50 * 86400000).toISOString(),
  };

  const mockPayments = [
    { id: 1, amount: '240000', currency: 'COP', status: 'confirmed', provider: 'wompi', provider_reference: 'ref-1', created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
    { id: 2, amount: '240000', currency: 'COP', status: 'pending', provider: 'wompi', provider_reference: 'ref-2', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 3, amount: '240000', currency: 'COP', status: 'failed', provider: 'wompi', provider_reference: 'ref-3', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];

  function setupSubscriptionMock(
    page: import('@playwright/test').Page,
    sub: typeof mockSubscription | null,
    payments: typeof mockPayments = [],
  ) {
    return Promise.all([
      page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
      }),
      page.route('**/api/subscriptions/*/payments/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payments) });
      }),
      page.route('**/api/subscriptions/*/cancel/**', async (route) => {
        if (sub) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...sub, status: 'canceled' }),
          });
        } else {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        }
      }),
      page.route('**/api/subscriptions/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/payments/') || url.includes('/cancel/')) {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: sub ? 1 : 0,
            next: null,
            previous: null,
            results: sub ? [sub] : [],
          }),
        });
      }),
    ]);
  }

  test('no active subscription shows empty state with link to programas', async ({ page }) => {
    await setupSubscriptionMock(page, null);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Sin suscripción activa')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Ver programas' })).toBeVisible();
  });

  test('active subscription renders details card', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    const main = page.getByRole('main');
    const detailsCard = main.getByText('Detalles').locator('..').locator('..');
    const programRow = detailsCard.getByText('Programa').locator('..');
    await expect(main.getByText('Mi Suscripción')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Detalles')).toBeVisible();
    await expect(programRow.getByText('Paquete Pro')).toBeVisible();
    await expect(detailsCard.getByText('Activa', { exact: true })).toBeVisible();
    await expect(detailsCard.getByText('3 / 8 usadas')).toBeVisible();
  });

  test('active subscription does not show paused actions', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Pausada', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Reanudar suscripción' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Pausar suscripción' })).not.toBeVisible();
  });

  test('active subscription renders payment history', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription, mockPayments);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Historial de pagos')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Confirmado')).toBeVisible();
    await expect(page.getByText('Pendiente')).toBeVisible();
    await expect(page.getByText('Fallido')).toBeVisible();
  });

  test('expired subscription appears as inactive', async ({ page }) => {
    const expiredSub = {
      ...mockSubscription,
      status: 'expired',
      sessions_used: 8,
      sessions_remaining: 0,
      next_billing_date: null,
    };
    await setupSubscriptionMock(page, expiredSub);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    const detailsCard = page.getByRole('main').getByText('Detalles').locator('..').locator('..');
    await expect(detailsCard.getByText('Expirada', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Esta suscripción está inactiva, por lo que no requiere acciones.')).toBeVisible();
  });

  test('active subscription renders cancel action as disabled', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    const cancelButton = page.getByRole('button', { name: 'Cancelar suscripción' });
    await expect(cancelButton).toBeVisible({ timeout: 10_000 });
    await expect(cancelButton).toBeDisabled();
  });

  test('disabled cancel action keeps confirmation dialog hidden', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    const cancelButton = page.getByRole('button', { name: 'Cancelar suscripción' });
    await expect(cancelButton).toBeDisabled({ timeout: 10_000 });
    await expect(page.getByText('¿Seguro que deseas cancelar?')).not.toBeVisible();
  });

  test('empty payment history shows placeholder', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription, []);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Historial de pagos')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Sin pagos registrados')).toBeVisible();
  });

  test('disabled cancel action does not surface cancellation error', async ({ page }) => {
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
    await page.route('**/api/subscriptions/*/payments/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/subscriptions/*/cancel/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSubscription] }),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/subscription');

    const cancelButton = page.getByRole('button', { name: 'Cancelar suscripción' });
    await expect(cancelButton).toBeDisabled({ timeout: 10_000 });
    await expect(page.getByText('No se pudo cancelar la suscripción.')).not.toBeVisible();
  });

  test('fetchPaymentHistory error shows error message', async ({ page }) => {
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
    await page.route('**/api/subscriptions/*/payments/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSubscription] }),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('No se pudo cargar el historial de pagos.')).toBeVisible({ timeout: 10_000 });
  });

  test('selecting a different subscription in dropdown updates the detail card', async ({ page }) => {
    // Exercise subscription/page.tsx onChange handler — setSelectedSubscriptionId(nextValue)
    // which causes the detail card to reflect the newly selected subscription.
    const secondSub = {
      id: 30,
      customer_email: 'e2e@kore.com',
      package: { id: 7, title: 'Paquete Básico', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 30 },
      sessions_total: 4, sessions_used: 4, sessions_remaining: 0, status: 'expired',
      starts_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
    await page.route('**/api/subscriptions/*/payments/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 2, next: null, previous: null, results: [mockSubscription, secondSub] }),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/subscription');

    const main = page.getByRole('main');
    await expect(main.getByText('Mi Suscripción')).toBeVisible({ timeout: 10_000 });

    // Wait for detail card to show the first subscription
    const detailsCard = main.getByText('Detalles').locator('..').locator('..');
    await expect(detailsCard.getByText('Paquete Pro')).toBeVisible({ timeout: 5_000 });

    // Change select to the second subscription — exercises onChange handler
    const select = page.getByRole('combobox');
    await select.selectOption({ value: String(secondSub.id) });

    // Detail card should now reflect the expired second subscription
    await expect(detailsCard.getByText('Paquete Básico')).toBeVisible({ timeout: 5_000 });
    await expect(detailsCard.getByText('Expirada', { exact: true }).or(detailsCard.getByText('Vencida', { exact: true }))).toBeVisible({ timeout: 5_000 });
  });

});

test.describe('subscriptionStore non-paginated array response', { tag: [...FlowTags.SUBSCRIPTION_PAGE, RoleTags.USER] }, () => {
  const bareSub = {
    id: 21,
    customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Paquete Pro', sessions_count: 8, session_duration_minutes: 60, price: '240000', currency: 'COP', validity_days: 60 },
    sessions_total: 8,
    sessions_used: 3,
    sessions_remaining: 5,
    status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
    next_billing_date: null,
  };

  test('fetchSubscriptions handles non-paginated bare array response', async ({ page }) => {
    const cookieUser = encodeURIComponent(JSON.stringify({
      id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba',
      phone: '', role: 'customer', name: 'Usuario Prueba',
    }));
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-jwt-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: cookieUser, domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer' } }) }));
    await page.route('**/api/bookings/upcoming-reminder/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }));
    await page.route('**/api/subscriptions/expiry-reminder/**', (r) => r.fulfill({ status: 204 }));
    await page.route('**/api/subscriptions/*/payments/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/') || url.includes('/expiry-reminder')) {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([bareSub]) });
    });

    await page.goto('/subscription');
    const main = page.getByRole('main');
    await expect(main.getByText('Mi Suscripci\u00f3n')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Activa', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});
