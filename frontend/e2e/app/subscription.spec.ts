import { test, expect, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';

/**
 * E2E tests for the Subscription page (/subscription).
 * Uses mocked API responses to exercise subscriptionStore actions
 * (pause, resume, cancel, fetchPaymentHistory) and the full page UI.
 */
test.describe('Subscription Page (mocked)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page);
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
    paused_at: string | null;
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
    paused_at: null,
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
      page.route('**/api/subscriptions/*/pause/**', async (route) => {
        if (sub) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...sub, status: 'paused', paused_at: new Date().toISOString() }),
          });
        } else {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        }
      }),
      page.route('**/api/subscriptions/*/resume/**', async (route) => {
        if (sub) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...sub, status: 'active', paused_at: null }),
          });
        } else {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        }
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
        if (url.includes('/payments/') || url.includes('/pause/') || url.includes('/resume/') || url.includes('/cancel/')) {
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
    await expect(main.getByText('Mi Suscripción')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Detalles')).toBeVisible();
    await expect(main.getByText('Paquete Pro')).toBeVisible();
    await expect(main.getByText('Activa')).toBeVisible();
    await expect(main.getByText('3 / 8 usadas')).toBeVisible();
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

  test('pause subscription changes status to Pausada', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Activa', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Pausar suscripción' }).click();
    await expect(page.getByText('Pausada', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('resume paused subscription changes status to Activa', async ({ page }) => {
    const pausedSub = { ...mockSubscription, status: 'paused', paused_at: new Date().toISOString() };
    await setupSubscriptionMock(page, pausedSub);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Pausada', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Reanudar suscripción' }).click();
    await expect(page.getByText('Activa', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('cancel flow — confirm cancellation', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Activa')).toBeVisible({ timeout: 10_000 });

    // Open cancel confirm dialog
    await page.getByRole('button', { name: 'Cancelar suscripción' }).click();
    await expect(page.getByText('¿Seguro que deseas cancelar?')).toBeVisible();

    // Confirm cancellation — after cancel, activeSubscription becomes null
    // so the page shows the "no subscription" empty state
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();
    await expect(page.getByText('Sin suscripción activa')).toBeVisible({ timeout: 10_000 });
  });

  test('cancel flow — abort with No, volver', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Activa')).toBeVisible({ timeout: 10_000 });

    // Open cancel confirm dialog
    await page.getByRole('button', { name: 'Cancelar suscripción' }).click();
    await expect(page.getByText('¿Seguro que deseas cancelar?')).toBeVisible();

    // Abort
    await page.getByRole('button', { name: 'No, volver' }).click();
    await expect(page.getByText('¿Seguro que deseas cancelar?')).not.toBeVisible();
    await expect(page.getByText('Activa')).toBeVisible();
  });

  test('empty payment history shows placeholder', async ({ page }) => {
    await setupSubscriptionMock(page, mockSubscription, []);
    await loginAsTestUser(page);
    await page.goto('/subscription');

    await expect(page.getByText('Historial de pagos')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Sin pagos registrados')).toBeVisible();
  });

  test('resumeSubscription error shows error message', async ({ page }) => {
    const pausedSub = { ...mockSubscription, status: 'paused', paused_at: new Date().toISOString() };

    // Setup standard mocks first, then override the resume route
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
    await page.route('**/api/subscriptions/*/payments/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/subscriptions/*/resume/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/resume/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [pausedSub] }),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/subscription');
    await expect(page.getByText('Pausada', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Reanudar suscripción' }).click();
    await expect(page.getByText('No se pudo reanudar la suscripción.')).toBeVisible({ timeout: 10_000 });
  });

  test('cancelSubscription error shows error message', async ({ page }) => {
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
    await expect(page.getByText('Activa', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Open cancel confirm dialog and confirm
    await page.getByRole('button', { name: 'Cancelar suscripción' }).click();
    await expect(page.getByText('¿Seguro que deseas cancelar?')).toBeVisible();
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();

    await expect(page.getByText('No se pudo cancelar la suscripción.')).toBeVisible({ timeout: 10_000 });
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
});
