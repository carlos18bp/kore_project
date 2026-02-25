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

  const mockCheckoutPreparation = {
    reference: 'ref-gap-001', signature: 'sig-gap-001',
    amount_in_cents: 24000000, currency: 'COP', package_title: 'Paquete Pro',
    checkout_access_token: 'test-access-token',
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

  async function mockWompiWidget(page: import('@playwright/test').Page, withTransaction: boolean) {
    const callbackPayload = withTransaction ? `{ transaction: { id: 'txn-gap-001' } }` : '{}';
    await page.route('**/checkout.wompi.co/widget.js', (r) => r.fulfill({
      status: 200, contentType: 'application/javascript',
      body: `window.WidgetCheckout = class { constructor() {} open(cb) { cb(${callbackPayload}); } };`,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 77-78 — authenticated user clears registration token
  // hasCheckoutAccess via isAuthenticated even when sessionStorage token present
  // ─────────────────────────────────────────────────────────────────────────
  test('authenticated user with registration token in sessionStorage still sees checkout', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidget(page, true);

    await seedAuthenticatedCookies(page);
    await page.goto('/programs');
    await page.evaluate(() => {
      sessionStorage.setItem('kore_checkout_registration_token', 'old-guest-token');
      sessionStorage.setItem('kore_checkout_registration_package', '6');
    });
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 193-196 — prepareCheckout returns null, sets
  // openingCheckout back to false without navigation
  // ─────────────────────────────────────────────────────────────────────────
  test('prepareCheckout failure shows store error and re-enables pay button', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidget(page, true);
    await page.route('**/api/subscriptions/prepare-checkout/**', (r) => r.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({}),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    await expect(page.getByText('No se pudo preparar el pago. Intenta de nuevo.')).toBeVisible({ timeout: 10_000 });
    await expect(payBtn).toBeEnabled({ timeout: 5_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 224-228 — widget callback fires without transactionId
  // (user closed Wompi widget without completing payment)
  // ─────────────────────────────────────────────────────────────────────────
  test('widget callback without transactionId shows payment error message', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidget(page, false);
    await page.route('**/api/subscriptions/prepare-checkout/**', (r) => r.fulfill({
      status: 201, contentType: 'application/json', body: JSON.stringify(mockCheckoutPreparation),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    await expect(page.getByText('No se pudo completar el pago. Intenta de nuevo.')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 165-168 — script.onerror handler sets widgetError=true
  // which renders the "No se pudo cargar la pasarela" error UI block.
  // ─────────────────────────────────────────────────────────────────────────
  test('widget script onerror sets widgetError and shows reload message', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    // Return 503 for the widget script — triggers script.onerror in the page
    await page.route('**/checkout.wompi.co/widget.js', (r) => r.fulfill({ status: 503, body: '' }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No se pudo cargar la pasarela de pago.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Recargar página' })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkout/page.tsx lines 87-90 — guest flow: !isAuthenticated + matching
  // sessionStorage registration token → hasCheckoutAccess=true, page renders.
  // ─────────────────────────────────────────────────────────────────────────
  test('guest with valid registration token in sessionStorage sees checkout page', async ({ page }) => {
    await setupCheckoutMocks(page);
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await mockWompiWidget(page, false);

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
  // checkoutStore.ts:253-255 — pollIntentStatus 'failed' branch sets
  // paymentStatus:'error'. checkout/page.tsx:438 — 'polling' renders
  // "Verificando pago..." during the 2-second wait before the API call.
  // ─────────────────────────────────────────────────────────────────────────
  test('pollIntentStatus failed shows polling text then rejected payment error', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page);
    await mockWompiWidget(page, true);
    await page.route('**/api/subscriptions/prepare-checkout/**', (r) => r.fulfill({
      status: 201, contentType: 'application/json', body: JSON.stringify(mockCheckoutPreparation),
    }));
    await page.route('**/api/subscriptions/intent-status/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 10, reference: 'ref-gap-001', wompi_transaction_id: 'txn-gap-001',
        status: 'failed', amount: '240000', currency: 'COP',
        package_title: 'Paquete Pro', created_at: new Date().toISOString(),
      }),
    }));

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    // During the 2-second polling interval paymentStatus='polling' → button text changes
    await expect(page.getByText('Verificando pago...')).toBeVisible({ timeout: 10_000 });
    // After polling resolves with 'failed' → error message shown
    await expect(page.getByText('El pago fue rechazado. Intenta con otro método de pago.')).toBeVisible({ timeout: 15_000 });
  });
});
