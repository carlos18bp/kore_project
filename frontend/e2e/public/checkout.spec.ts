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

  async function mockCardTokenization(page: import('@playwright/test').Page) {
    await page.route('**/sandbox.wompi.co/v1/tokens/cards', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'tok_test_e2e_card' } }),
      });
    });
  }

  async function mockWompiWidgetScript(page: import('@playwright/test').Page) {
    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor() {} open() {} };`,
      });
    });
  }

  async function selectCardAndFillForm(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: /Tarjeta/ }).click();
    await page.getByLabel('Número de tarjeta').fill('4242 4242 4242 4242');
    await page.getByLabel('Vencimiento').fill('1228');
    await page.getByLabel('CVV').fill('123');
    await page.getByLabel('Nombre en la tarjeta').fill('USUARIO PRUEBA');
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

    await selectCardAndFillForm(page);
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
    await mockCardTokenization(page);
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentPending = buildIntent(50, 'pending', 'tok_test_e2e_card');
    const intentApproved = {
      ...intentPending,
      status: 'approved' as const,
    };

    await mockPurchaseIntent(page, intentPending);
    await mockIntentStatus(page, intentApproved);

    await openCheckoutAndPay(page);
    await expect(page.getByText('¡Pago exitoso!')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Tu suscripción ha sido activada')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a mi dashboard' })).toBeVisible();
  });

  test('card payment form renders after selecting Tarjeta method', async ({ page }) => {
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Tarjeta/ }).click();
    await expect(page.getByLabel('Número de tarjeta')).toBeVisible();
    await expect(page.getByLabel('Vencimiento')).toBeVisible();
    await expect(page.getByLabel('CVV')).toBeVisible();
    await expect(page.getByLabel('Nombre en la tarjeta')).toBeVisible();
  });

  test('purchaseSubscription error shows error message', async ({ page }) => {
    await mockCardTokenization(page);
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentPending = buildIntent(53, 'pending', 'tok_test_e2e_card');
    const intentFailed = { ...intentPending, status: 'failed' as const };
    await mockPurchaseIntent(page, intentPending);
    await mockIntentStatus(page, intentFailed);

    await openCheckoutAndPay(page);
    await expect(
      page.getByText('El pago fue rechazado. Intenta con otro método de pago.'),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('polling failure shows rejection message', async ({ page }) => {
    await mockCardTokenization(page);
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentPending = buildIntent(51, 'pending', 'tok_test_e2e_card');
    const intentFailed = {
      ...intentPending,
      status: 'failed' as const,
    };

    await mockPurchaseIntent(page, intentPending);
    await mockIntentStatus(page, intentFailed);

    await openCheckoutAndPay(page);
    await expect(page.getByText(/rechazado/)).toBeVisible({ timeout: 15_000 });
  });

  test('fetchWompiConfig error shows config error message', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage, null);

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');

    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No se pudo cargar la configuración de pago.')).toBeVisible({ timeout: 10_000 });
  });

  test('payment method selector shows all four options', async ({ page }) => {
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: /Tarjeta/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nequi/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /PSE/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bancolombia/ })).toBeVisible();
  });

  test('card tokenization failure shows error message', async ({ page }) => {
    await page.route('**/sandbox.wompi.co/v1/tokens/cards', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Datos de tarjeta inválidos' } }),
      });
    });
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    await openCheckoutAndPay(page);
    await expect(page.getByText(/Datos de tarjeta inválidos|Error al procesar la tarjeta/)).toBeVisible({ timeout: 10_000 });
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

  test('nequi form renders after selecting Nequi method', async ({ page }) => {
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Nequi/ }).click();
    await expect(page.getByLabel(/Número de celular Nequi/)).toBeVisible();
    await expect(page.getByText('Recibirás una notificación en tu app Nequi')).toBeVisible();
  });

  test('nequi payment success shows pago exitoso', async ({ page }) => {
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentPending = buildIntent(60, 'pending', 'txn_nequi_001');
    const intentApproved = { ...intentPending, status: 'approved' as const };

    await page.route('**/api/subscriptions/purchase-alternative/**', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(intentPending),
      });
    });
    await mockIntentStatus(page, intentApproved);

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Nequi/ }).click();
    await page.getByLabel(/Número de celular Nequi/).fill('3001234567');
    const payBtn = page.getByRole('button', { name: /Pagar.*Nequi/ });
    await expect(payBtn).toBeEnabled({ timeout: 10_000 });
    await payBtn.click();

    await expect(page.getByText('¡Pago exitoso!')).toBeVisible({ timeout: 15_000 });
  });

  test('pse form renders after selecting PSE method', async ({ page }) => {
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    await page.route('**/sandbox.wompi.co/v1/pse/financial_institutions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { financial_institution_code: '1007', financial_institution_name: 'BANCOLOMBIA' },
            { financial_institution_code: '1051', financial_institution_name: 'DAVIVIENDA' },
          ],
        }),
      });
    });

    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /PSE/ }).click();
    await expect(page.getByText('Serás redirigido a tu banco')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Banco')).toBeVisible();
    await expect(page.getByLabel('Número de documento')).toBeVisible();
    await expect(page.getByLabel('Nombre completo')).toBeVisible();
  });

  test('bancolombia form renders after selecting Bancolombia method', async ({ page }) => {
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Bancolombia/ }).click();
    await expect(page.getByText('Serás redirigido a Bancolombia')).toBeVisible();
    await expect(page.locator('form').getByText('Paquete Pro')).toBeVisible();

    const payBtn = page.getByRole('button', { name: /Pagar.*Bancolombia/ });
    await expect(payBtn).toBeDisabled();

    await page.getByRole('checkbox').check();
    await expect(payBtn).toBeEnabled();
  });

  test('switching payment methods shows correct form', async ({ page }) => {
    await mockWompiWidgetScript(page);
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await seedAuthenticatedCookies(page);
    await page.goto('/checkout?package=6');
    await expect(
      page.getByRole('heading', { name: 'Resumen del programa' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Tarjeta/ }).click();
    await expect(page.getByLabel('Número de tarjeta')).toBeVisible();

    await page.getByRole('button', { name: /Nequi/ }).click();
    await expect(page.getByLabel(/Número de celular Nequi/)).toBeVisible();
    await expect(page.getByLabel('Número de tarjeta')).not.toBeVisible();
  });

  async function setupGuestAutoLoginMocks(page: import('@playwright/test').Page) {
    const autoLoginUser = {
      id: 42, email: 'guest@kore.com', first_name: 'Guest', last_name: 'User', phone: '', role: 'customer',
    };
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({ status: 401, body: '' }));
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/packages/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPackage) }));
    await page.route('**/api/wompi/config/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockWompiConfig) }));
    await page.route('**/api/subscriptions/purchase/**', (r) => r.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ ...buildIntent(99, 'pending', 'tok_test_e2e_card'), checkout_access_token: 'guest-access-token' }),
    }));
    await page.route('**/api/subscriptions/intent-status/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ...buildIntent(99, 'approved', 'tok_test_e2e_card'),
        auto_login: { access: 'auto-login-access-token', refresh: 'auto-login-refresh-token', user: autoLoginUser },
      }),
    }));
    await mockCardTokenization(page);
    await mockWompiWidgetScript(page);
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
    await selectCardAndFillForm(page);
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    await expect(page.getByText('¡Pago exitoso!')).toBeVisible({ timeout: 15_000 });

    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'kore_token');
    expect(tokenCookie?.value).toBe('auto-login-access-token');
  });
});
