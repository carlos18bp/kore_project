import { test, expect, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';

/**
 * E2E tests for the Checkout page (/checkout).
 * Covers checkoutStore (fetchPackage, fetchWompiConfig, error states) + checkout page UI.
 */
test.describe('Checkout Page (mocked)', () => {
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

  function setupCheckoutMocks(
    page: import('@playwright/test').Page,
    pkg: typeof mockPackage | null,
    wompi: typeof mockWompiConfig | null = mockWompiConfig,
  ) {
    return Promise.all([
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

  test('unauthenticated user is redirected to register with package param', async ({ page }) => {
    await page.goto('/checkout?package=6');
    await page.waitForURL(/\/register\?package=6/, { timeout: 10_000 });
  });

  test('no package param shows Paquete no encontrado', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, null);
    await loginAsTestUser(page);
    await page.goto('/checkout');

    await expect(page.getByText('Paquete no encontrado')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Ver programas disponibles' })).toBeVisible();
  });

  test('valid package renders checkout summary', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);
    await loginAsTestUser(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByText('Resumen del programa')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Paquete Pro')).toBeVisible();
    await expect(page.getByText('8')).toBeVisible(); // sessions_count
    await expect(page.getByText('60 días', { exact: true })).toBeVisible();
  });

  test('package fetch error shows error message', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
    await page.route('**/api/packages/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/wompi/config/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockWompiConfig) });
    });

    await loginAsTestUser(page);
    await page.goto('/checkout?package=6');

    await expect(page.getByText(/No se pudo cargar el paquete|Paquete no encontrado/)).toBeVisible({ timeout: 10_000 });
  });

  test('purchaseSubscription success renders ¡Pago exitoso!', async ({ page }) => {
    // Mock Wompi widget script so it loads and enables the pay button
    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor() {} open(cb) { cb({ transaction: { id: 'mock-txn-123' } }); } };`,
      });
    });

    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentPending = {
      id: 50,
      reference: 'ref-e2e-001',
      wompi_transaction_id: 'mock-txn-123',
      status: 'pending',
      amount: '240000',
      currency: 'COP',
      package_title: 'Paquete Pro',
      created_at: new Date().toISOString(),
    };

    const intentApproved = { ...intentPending, status: 'approved' };

    // Mock the purchase endpoint → returns pending intent
    await page.route('**/api/subscriptions/purchase/**', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(intentPending),
      });
    });

    // Mock the intent-status polling endpoint → returns approved
    await page.route('**/api/subscriptions/intent-status/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(intentApproved),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByText('Resumen del programa')).toBeVisible({ timeout: 10_000 });

    // Wait for the Wompi widget to load and pay button to become enabled
    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    // Success screen
    await expect(page.getByText('¡Pago exitoso!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Tu suscripción ha sido activada')).toBeVisible();
    await expect(page.getByText('Sesiones')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a mi dashboard' })).toBeVisible();
  });

  test('purchaseSubscription error shows error message', async ({ page }) => {
    // Mock Wompi widget script
    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor() {} open(cb) { cb({ transaction: { id: 'mock-txn-fail' } }); } };`,
      });
    });

    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    // Mock the purchase endpoint → error
    await page.route('**/api/subscriptions/purchase/**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Tarjeta rechazada.' }),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByText('Resumen del programa')).toBeVisible({ timeout: 10_000 });

    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    // Error message should appear
    await expect(page.getByText('Tarjeta rechazada.')).toBeVisible({ timeout: 10_000 });
  });

  test('polling failure shows rejection message', async ({ page }) => {
    // Mock Wompi widget script
    await page.route('**/checkout.wompi.co/widget.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.WidgetCheckout = class { constructor() {} open(cb) { cb({ transaction: { id: 'mock-txn-declined' } }); } };`,
      });
    });

    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage);

    const intentPending = {
      id: 51,
      reference: 'ref-e2e-declined',
      wompi_transaction_id: 'mock-txn-declined',
      status: 'pending',
      amount: '240000',
      currency: 'COP',
      package_title: 'Paquete Pro',
      created_at: new Date().toISOString(),
    };

    const intentFailed = { ...intentPending, status: 'failed' };

    // Mock the purchase endpoint → returns pending intent
    await page.route('**/api/subscriptions/purchase/**', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(intentPending),
      });
    });

    // Mock the intent-status polling endpoint → returns failed
    await page.route('**/api/subscriptions/intent-status/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(intentFailed),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/checkout?package=6');
    await expect(page.getByText('Resumen del programa')).toBeVisible({ timeout: 10_000 });

    const payBtn = page.getByRole('button', { name: /Pagar/ });
    await expect(payBtn).toBeEnabled({ timeout: 15_000 });
    await payBtn.click();

    // Rejection error should appear
    await expect(page.getByText(/rechazado/)).toBeVisible({ timeout: 15_000 });
  });

  test('fetchWompiConfig error shows config error message', async ({ page }) => {
    // Setup with null wompi → triggers 500
    await setupDefaultApiMocks(page);
    await setupCheckoutMocks(page, mockPackage, null);

    await loginAsTestUser(page);
    await page.goto('/checkout?package=6');

    // The package loads fine but wompi config fails
    await expect(page.getByText('Resumen del programa')).toBeVisible({ timeout: 10_000 });
    // Pay button should show loading state since widget can't load
    await expect(page.getByText('Cargando pasarela de pago...')).toBeVisible({ timeout: 10_000 });
  });
});
