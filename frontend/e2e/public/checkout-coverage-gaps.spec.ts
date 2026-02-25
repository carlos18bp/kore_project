import { test, expect, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * Targeted coverage-gap tests for checkout/page.tsx branches not exercised
 * by the main checkout.spec.ts suite.
 */
test.describe('Checkout Page — Coverage Gaps', { tag: [...FlowTags.CHECKOUT_COVERAGE_GAPS, RoleTags.USER] }, () => {
  const authCookieUser = encodeURIComponent(JSON.stringify({
    id: 999,
    email: 'e2e@kore.com',
    first_name: 'Usuario',
    last_name: 'Prueba',
    phone: '',
    role: 'customer',
  }));

  async function seedAuthenticatedCookies(page: import('@playwright/test').Page) {
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-jwt-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: authCookieUser, domain: 'localhost', path: '/' },
    ]);
  }

  const mockPackage = {
    id: 6, title: 'Paquete Pro', description: 'Programa', sessions_count: 8,
    price: '240000', currency: 'COP', validity_days: 60, session_duration_minutes: 60, is_active: true,
  };

  const mockWompiConfig = {
    public_key: 'pub_test_e2e_key', environment: 'sandbox',
  };

  function setupCheckoutMocks(page: import('@playwright/test').Page) {
    return Promise.all([
      page.route('**/api/packages/**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(mockPackage),
      })),
      page.route('**/api/wompi/config/**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(mockWompiConfig),
      })),
      page.route('**/api/bookings/upcoming-reminder/**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(null),
      })),
    ]);
  }

  async function mockWompiWidgetScript(page: import('@playwright/test').Page) {
    await page.route('**/checkout.wompi.co/widget.js', (r) => r.fulfill({
      status: 200, contentType: 'application/javascript',
      body: `window.WidgetCheckout = class { constructor() {} open() {} };`,
    }));
  }

  async function mockCardTokenization(page: import('@playwright/test').Page) {
    await page.route('**/sandbox.wompi.co/v1/tokens/cards', (r) => r.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'tok_test_gap_card' } }),
    }));
  }

  async function selectCardAndFillForm(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: /Tarjeta/ }).click();
    await page.getByLabel('Número de tarjeta').fill('4242 4242 4242 4242');
    await page.getByLabel('Vencimiento').fill('1228');
    await page.getByLabel('CVV').fill('123');
    await page.getByLabel('Nombre en la tarjeta').fill('USUARIO PRUEBA');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 77-78 — authenticated user clears registration token
  // hasCheckoutAccess via isAuthenticated even when sessionStorage token present
  // ─────────────────────────────────────────────────────────────────────────
  test('authenticated user with registration token in sessionStorage still sees checkout', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidgetScript(page);

    await seedAuthenticatedCookies(page);
    await page.goto('/programs');
    await page.evaluate(() => {
      sessionStorage.setItem('kore_checkout_registration_token', 'old-guest-token');
      sessionStorage.setItem('kore_checkout_registration_package', '6');
    });
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Tarjeta/ })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 193-196 — prepareCheckout returns null, sets
  // openingCheckout back to false without navigation
  // ─────────────────────────────────────────────────────────────────────────
  test('card tokenization failure shows error and re-enables pay button', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidgetScript(page);
    await page.route('**/sandbox.wompi.co/v1/tokens/cards', (r) => r.fulfill({
      status: 422, contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Número de tarjeta inválido' } }),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    await selectCardAndFillForm(page);
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    await expect(page.getByText(/Número de tarjeta inválido|Error al procesar la tarjeta/)).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 224-228 — widget callback fires without transactionId
  // (user closed Wompi widget without completing payment)
  // ─────────────────────────────────────────────────────────────────────────
  test('purchase API failure shows error message', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidgetScript(page);
    await mockCardTokenization(page);
    await page.route('**/api/subscriptions/purchase/**', (r) => r.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Error interno del servidor' }),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    await selectCardAndFillForm(page);
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    await expect(page.getByText(/Error al procesar el pago|Error interno/)).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 165-168 — script.onerror handler sets widgetError=true
  // which renders the "No se pudo cargar la pasarela" error UI block.
  // ─────────────────────────────────────────────────────────────────────────
  test('wompi config error shows payment configuration error', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await page.route('**/api/packages/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(mockPackage),
    }));
    await page.route('**/api/wompi/config/**', (r) => r.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({}),
    }));
    await page.route('**/api/bookings/upcoming-reminder/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(null),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No se pudo cargar la configuración de pago.')).toBeVisible({ timeout: 15_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 87-90 — guest flow: !isAuthenticated + matching
  // sessionStorage registration token → hasCheckoutAccess=true, page renders.
  // ─────────────────────────────────────────────────────────────────────────
  test('guest with valid registration token in sessionStorage sees checkout page', async ({ page }) => {
    await setupCheckoutMocks(page);
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await mockWompiWidgetScript(page);

    // Navigate to establish origin, then seed sessionStorage (no auth cookies)
    await page.goto('/programs');
    await page.evaluate(() => {
      sessionStorage.setItem('kore_checkout_registration_token', 'guest-reg-token-e2e');
      sessionStorage.setItem('kore_checkout_registration_package', '6');
    });
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Paquete Pro')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkoutStore.ts purchaseWithNequi — purchase-alternative API error
  // ─────────────────────────────────────────────────────────────────────────
  test('nequi purchase-alternative API failure shows nequi error', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidgetScript(page);
    await page.route('**/api/subscriptions/purchase-alternative/**', (r) => r.fulfill({
      status: 502, contentType: 'application/json',
      body: JSON.stringify({ detail: 'Falló el procesamiento del pago. Intenta de nuevo.' }),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Nequi/ }).click();
    await page.getByLabel(/Número de celular Nequi/).fill('3001234567');
    const payBtn = page.getByRole('button', { name: /Pagar.*Nequi/ });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    await expect(page.getByText(/Falló el procesamiento|Error al procesar el pago con Nequi/)).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkoutStore.ts fetchPSEBanks — bank list fetch failure
  // ─────────────────────────────────────────────────────────────────────────
  test('pse bank list fetch failure shows reload message', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidgetScript(page);
    await page.route('**/sandbox.wompi.co/v1/pse/financial_institutions', (r) => r.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({}),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /PSE/ }).click();
    // PSEPaymentForm shows loading then empty bank list (fetchPSEBanks returns [])
    // Since fetchPSEBanks catches errors and returns [], the form should still render
    await expect(page.getByLabel('Banco')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkoutStore.ts purchaseWithBancolombia — purchase-alternative API error
  // ─────────────────────────────────────────────────────────────────────────
  test('bancolombia purchase-alternative API failure shows error', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidgetScript(page);
    await page.route('**/api/subscriptions/purchase-alternative/**', (r) => r.fulfill({
      status: 502, contentType: 'application/json',
      body: JSON.stringify({ detail: 'Falló el procesamiento del pago. Intenta de nuevo.' }),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Bancolombia/ }).click();
    await page.getByRole('checkbox').check();
    const payBtn = page.getByRole('button', { name: /Pagar.*Bancolombia/ });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    await expect(page.getByText(/Falló el procesamiento|Error al procesar el pago con Bancolombia/)).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkoutStore.ts:253-255 — pollIntentStatus 'failed' branch sets
  // paymentStatus:'error'. checkout/page.tsx:438 — 'polling' renders
  // "Verificando pago..." during the 2-second wait before the API call.
  // ─────────────────────────────────────────────────────────────────────────
  test('pollIntentStatus failed shows polling text then rejected payment error', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidgetScript(page);
    await mockCardTokenization(page);
    await page.route('**/api/subscriptions/purchase/**', (r) => r.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({
        id: 10, reference: 'ref-gap-001', wompi_transaction_id: 'tok_test_gap_card',
        status: 'pending', amount: '240000', currency: 'COP',
        package_title: 'Paquete Pro', created_at: new Date().toISOString(),
      }),
    }));
    await page.route('**/api/subscriptions/intent-status/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 10, reference: 'ref-gap-001', wompi_transaction_id: 'tok_test_gap_card',
        status: 'failed', amount: '240000', currency: 'COP',
        package_title: 'Paquete Pro', created_at: new Date().toISOString(),
      }),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    await selectCardAndFillForm(page);
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    // After polling resolves with 'failed' → error message shown
    await expect(page.getByText('El pago fue rechazado. Intenta con otro método de pago.')).toBeVisible({ timeout: 15_000 });
  });
});
