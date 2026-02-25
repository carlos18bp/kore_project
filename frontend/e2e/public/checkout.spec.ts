import { test, expect, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Checkout page (/checkout).
 * Covers checkoutStore (fetchPackage, fetchWompiConfig, error states) + checkout page UI.
 */
test.describe('Checkout Page (mocked)', { tag: [...FlowTags.CHECKOUT_FLOW, RoleTags.USER] }, () => {
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
    description: 'Programa de entrenamiento personalizado',
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

  const mockCheckoutPreparation = {
    reference: 'ref-checkout-001',
    signature: 'sig-checkout-001',
    amount_in_cents: 24000000,
    currency: 'COP',
    package_title: 'Paquete Pro',
  };

  function setupCheckoutMocks(
    page: import('@playwright/test').Page,
    pkg: typeof mockPackage | null,
    wompi: typeof mockWompiConfig | null = mockWompiConfig,
  ) {
    return Promise.all([
      page.route('**/api/auth/profile/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 999,
              email: 'e2e@kore.com',
              first_name: 'Usuario',
              last_name: 'Prueba',
              phone: '',
              role: 'customer',
            },
          }),
        });
      }),
      page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
      }),
      page.route('**/api/packages/**', async (route) => {
        if (pkg) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pkg) });
        } else {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        }
      }),
      page.route('**/api/wompi/config/**', async (route) => {
        if (wompi) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wompi) });
        } else {
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Config error' }) });
        }
      }),
    ]);
  }

  type IntentStatus = 'pending' | 'approved' | 'failed';

  function buildIntent(
    id: number,
    status: IntentStatus,
    wompiTransactionId: string,
  ) {
    return {
      id,
      reference: mockCheckoutPreparation.reference,
      wompi_transaction_id: wompiTransactionId,
      status,
      amount: '240000',
      currency: 'COP',
      package_title: 'Paquete Pro',
      created_at: new Date().toISOString(),
    };
  }

  async function mockWompiWidgetScript(
    page: import('@playwright/test').Page,
    transactionId?: string,
  ) {
    const callbackPayload = transactionId
      ? `{ transaction: { id: '${transactionId}' } }`
      : '{}';

    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor() {} open(cb) { cb(${callbackPayload}); } };`,
      });
    });
  }

  async function mockPrepareCheckout(
    page: import('@playwright/test').Page,
    onPayload?: (payload: { package_id?: number }) => void,
  ) {
    await page.route('**/api/subscriptions/prepare-checkout/**', async (route) => {
      const payload = route.request().postDataJSON() as { package_id?: number };
      onPayload?.(payload);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(mockCheckoutPreparation),
      });
    });
  }

  async function mockPurchaseIntent(
    page: import('@playwright/test').Page,
    intent: ReturnType<typeof buildIntent>,
  ) {
    await page.route('**/api/subscriptions/purchase/**', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(intent),
      });
    });
  }

  async function mockIntentStatus(
    page: import('@playwright/test').Page,
    intent: ReturnType<typeof buildIntent>,
  ) {
    await page.route('**/api/subscriptions/intent-status/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(intent),
      });
    });
  }

  async function openCheckoutAndPay(page: import('@playwright/test').Page) {
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    return payBtn;
  }

  test('unauthenticated user is redirected to register with package param', async ({ page }) => {
    await page.goto('/checkout?package=6');
    await expect(page).toHaveURL(/\/register\?package=6/, { timeout: 15_000 });
  });

  test('no package param shows Paquete no encontrado', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, null);
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout');

    await expect(page.getByText('Paquete no encontrado')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Ver programas disponibles' })).toBeVisible();
  });

  test('valid package renders checkout summary', async ({ page }) => {
    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor() {} open(cb) { cb({ transaction: { id: 'txn_mock_summary' } }); } };`,
      });
    });

    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await page.route('**/api/subscriptions/prepare-checkout/**', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(mockCheckoutPreparation),
      });
    });
    const packageResponse = page.waitForResponse(
      (response) => response.url().includes('/api/packages/') && response.status() === 200,
    );
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await packageResponse;

    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Paquete Pro')).toBeVisible();
    await expect(page.getByText('8')).toBeVisible(); // sessions_count
    await expect(page.getByText('60 días', { exact: true })).toBeVisible();
  });

  test('package fetch error shows error message', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await page.route('**/api/auth/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 999,
            email: 'e2e@kore.com',
            first_name: 'Usuario',
            last_name: 'Prueba',
            phone: '',
            role: 'customer',
          },
        }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
    await page.route('**/api/packages/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/wompi/config/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockWompiConfig) });
    });

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByText(/No se pudo cargar el paquete|Paquete no encontrado/)).toBeVisible({ timeout: 10_000 });
  });

  test('purchaseSubscription success renders ¡Pago exitoso!', async ({ page }) => {
    let capturedReference = '';
    await mockWompiWidgetScript(page, 'txn_mock_4242');
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentPending = buildIntent(50, 'pending', 'mock-txn-123');
    const intentApproved = {
      ...intentPending,
      status: 'approved' as const,
    };

    await mockPrepareCheckout(page, (payload) => {
      capturedReference = payload.package_id ? mockCheckoutPreparation.reference : '';
    });
    await mockPurchaseIntent(page, intentPending);
    await mockIntentStatus(page, intentApproved);

    await openCheckoutAndPay(page);
    await expect(page.getByText('¡Pago exitoso!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Tu suscripción ha sido activada')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a mi dashboard' })).toBeVisible();
    expect(capturedReference).toBe(mockCheckoutPreparation.reference);
  });

  test('Wompi widget config does not request payer legal document', async ({ page }) => {
    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor(config) { window.__wompiConfig = config; } open(cb) { cb({}); } };`,
      });
    });

    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    const wompiConfig = await page.evaluate(() => (window as Record<string, unknown>).__wompiConfig as Record<string, unknown> | undefined);
    expect(wompiConfig?.collectCustomerLegalId).toBeUndefined();
    expect(wompiConfig?.['customer-data:email']).toBeUndefined();
    expect(wompiConfig?.['customer-data:full-name']).toBeUndefined();
  });

  test('purchaseSubscription error shows error message', async ({ page }) => {
    await mockWompiWidgetScript(page, 'txn_mock_fail');
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentFailed = buildIntent(53, 'failed', 'mock-txn-failed');
    await mockPrepareCheckout(page);
    await mockIntentStatus(page, intentFailed);

    await openCheckoutAndPay(page);
    await expect(
      page.getByText('El pago fue rechazado. Intenta con otro método de pago.'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('polling failure shows rejection message', async ({ page }) => {
    await mockWompiWidgetScript(page, 'txn_mock_declined');
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentPending = buildIntent(51, 'pending', 'mock-txn-declined');
    const intentFailed = {
      ...intentPending,
      status: 'failed' as const,
    };

    await mockPrepareCheckout(page);
    await mockPurchaseIntent(page, intentPending);
    await mockIntentStatus(page, intentFailed);

    await openCheckoutAndPay(page);
    await expect(page.getByText(/rechazado/)).toBeVisible({ timeout: 15_000 });
  });

  test('fetchWompiConfig error shows config error message', async ({ page }) => {
    // Setup with null wompi → triggers 500
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage, null);

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    // The package loads fine but wompi config fails
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });
    // Pay button should show loading state since widget can't load
    await expect(page.getByText('Cargando pasarela de pago...')).toBeVisible({ timeout: 10_000 });
  });

  test('wompi script already loaded reuses existing script', async ({ page }) => {
    // First load: inject the Wompi script element before navigating
    // This exercises checkout/page.tsx line 73-75 (script already exists)
    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor() {} open(cb) { cb({ transaction: { id: 'txn_mock_existing' } }); } };`,
      });
    });

    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await seedAuthenticatedCookies(page);

    // First visit to checkout — script loads
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });

    // Navigate away and back — script already exists
    await page.goto('/dashboard');
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });
    // Pay button should be enabled immediately since script already loaded
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
  });

  test('wompi widget callback without transaction id does not call purchase', async ({ page }) => {
    // This exercises checkout/page.tsx branch when tokenization callback has no token
    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor() {} open(cb) { cb({}); } };`,
      });
    });

    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    // Should return to idle state without calling purchase (no error, no success)
    // The button should become enabled again after the checkout finishes
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
  });

  test('fetchWompiConfig missing public_key shows payment config error', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage, mockWompiConfig);
    await page.route('**/api/wompi/config/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ environment: 'sandbox' }),
      });
    });

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No se pudo cargar la configuración de pago.')).toBeVisible({ timeout: 10_000 });
  });

  async function setupGuestAutoLoginMocks(page: import('@playwright/test').Page) {
    const autoLoginUser = {
      id: 42, email: 'guest@kore.com', first_name: 'Guest', last_name: 'User', phone: '', role: 'customer',
    };
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({ status: 401, body: '' }));
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/packages/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPackage) }));
    await page.route('**/api/wompi/config/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockWompiConfig) }));
    await page.route('**/api/subscriptions/prepare-checkout/**', (r) => r.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ ...mockCheckoutPreparation, checkout_access_token: 'guest-access-token' }),
    }));
    await page.route('**/api/subscriptions/intent-status/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ...buildIntent(99, 'approved', 'txn-autologin-001'),
        auto_login: { access: 'auto-login-access-token', refresh: 'auto-login-refresh-token', user: autoLoginUser },
      }),
    }));
    await mockWompiWidgetScript(page, 'txn-autologin-001');
    await page.route('**/api/bookings/upcoming-reminder/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }));
  }

  test('approved intent with auto_login applies guest auth cookies and shows success', async ({ page }) => {
    await setupGuestAutoLoginMocks(page);

    await page.goto('/programs');
    await page.evaluate(() => {
      sessionStorage.setItem('kore_checkout_registration_token', 'guest-reg-token-e2e');
      sessionStorage.setItem('kore_checkout_registration_package', '6');
    });
    await page.goto('/checkout?package=6');

    await expect(page.getByRole('heading', { name: 'Resumen del programa' })).toBeVisible({ timeout: 10_000 });
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    await expect(page.getByText('¡Pago exitoso!')).toBeVisible({ timeout: 10_000 });

    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'kore_token');
    expect(tokenCookie?.value).toBe('auto-login-access-token');
  });
});
