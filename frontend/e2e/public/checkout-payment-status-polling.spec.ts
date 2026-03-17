import { test, expect, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for checkout payment status polling cycle.
 * @flow:checkout-payment-status-polling
 *
 * Covers: submit payment → processing indicator → approved/failed resolution.
 * Uses mocked API responses; no real backend or Wompi required.
 */
test.describe('Checkout Payment Status Polling', { tag: [...FlowTags.CHECKOUT_PAYMENT_STATUS_POLLING, RoleTags.USER] }, () => {

  const authCookieUser = encodeURIComponent(JSON.stringify({
    id: 999,
    email: 'e2e@kore.com',
    first_name: 'Usuario',
    last_name: 'Prueba',
    phone: '',
    role: 'customer',
    name: 'Usuario Prueba',
  }));

  async function seedAuthenticatedCookies(page: import('@playwright/test').Page) {
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-jwt-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: authCookieUser, domain: 'localhost', path: '/' },
    ]);
  }

  const mockPackage = {
    id: 6,
    title: 'Paquete Pro',
    description: 'Programa personalizado',
    sessions_count: 8,
    price: '240000',
    currency: 'COP',
    validity_days: 60,
    is_active: true,
  };

  const mockWompiConfig = {
    public_key: 'pub_test_mock_key',
    environment: 'sandbox',
  };

  function buildIntent(id: number, status: 'pending' | 'approved' | 'failed', txnId: string) {
    return {
      id,
      reference: `ref-poll-${id}`,
      wompi_transaction_id: txnId,
      status,
      amount: '240000',
      currency: 'COP',
      package_title: 'Paquete Pro',
      created_at: new Date().toISOString(),
    };
  }

  async function setupBaseMocks(page: import('@playwright/test').Page) {
    await setupDefaultApiMocks(page);
    await Promise.all([
      page.route('**/api/packages/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPackage) });
      }),
      page.route('**/api/wompi/config/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockWompiConfig) });
      }),
      page.route('**/sandbox.wompi.co/v1/tokens/cards', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { id: 'tok_test_e2e_poll' } }),
        });
      }),
      page.route('**/checkout.wompi.co/widget.js', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: `window.WidgetCheckout = class { constructor() {} open() {} };`,
        });
      }),
    ]);
  }

  async function fillCardAndSubmit(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: /Tarjeta/ }).click();
    await page.getByLabel('Número de tarjeta').fill('4242 4242 4242 4242');
    await page.getByLabel('Vencimiento').fill('1228');
    await page.getByLabel('CVV').fill('123');
    await page.getByLabel('Nombre en la tarjeta').fill('USUARIO PRUEBA');
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();
  }

  test('polling resolves to approved and shows success screen', async ({ page }) => {
    await setupBaseMocks(page);

    const intentPending = buildIntent(70, 'pending', 'txn_poll_001');
    const intentApproved = { ...intentPending, status: 'approved' as const };

    await page.route('**/api/subscriptions/purchase/**', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(intentPending) });
    });
    await page.route('**/api/subscriptions/intent-status/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(intentApproved) });
    });

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });

    await fillCardAndSubmit(page);

    await expect(page.getByText('¡Pago exitoso!')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Tu suscripción ha sido activada')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a mi dashboard' })).toBeVisible();
  });

  test('polling resolves to failed and shows rejection message', async ({ page }) => {
    await setupBaseMocks(page);

    const intentPending = buildIntent(71, 'pending', 'txn_poll_002');
    const intentFailed = { ...intentPending, status: 'failed' as const };

    await page.route('**/api/subscriptions/purchase/**', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(intentPending) });
    });
    await page.route('**/api/subscriptions/intent-status/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(intentFailed) });
    });

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });

    await fillCardAndSubmit(page);

    await expect(page.getByText(/rechazado/)).toBeVisible({ timeout: 15_000 });
  });

  test('polling stays pending then resolves to approved', async ({ page }) => {
    await setupBaseMocks(page);

    const intentPending = buildIntent(72, 'pending', 'txn_poll_003');
    const intentApproved = { ...intentPending, status: 'approved' as const };

    await page.route('**/api/subscriptions/purchase/**', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(intentPending) });
    });

    // First poll returns pending, second returns approved
    let pollCount = 0;
    await page.route('**/api/subscriptions/intent-status/**', async (route) => {
      pollCount++;
      const body = pollCount <= 1 ? intentPending : intentApproved;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });

    await fillCardAndSubmit(page);

    await expect(page.getByText('¡Pago exitoso!')).toBeVisible({ timeout: 20_000 });
  });
});
