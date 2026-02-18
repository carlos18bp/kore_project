import { test, expect, setupDefaultApiMocks } from '../fixtures';

/**
 * E2E tests for the Register page (/register).
 * Covers pre-register validation and redirect to checkout flow.
 */
test.describe('Register Page', () => {
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

  async function mockAuthenticatedProfile(page: import('@playwright/test').Page) {
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
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders register form with all fields', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'KÓRE', exact: true })).toBeVisible();
    await expect(page.getByLabel('Nombre')).toBeVisible();
    await expect(page.getByLabel('Apellido')).toBeVisible();
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/Teléfono/i)).toBeVisible();
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirmar contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar al pago' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inicia sesión' })).toBeVisible();
  });

  test('password mismatch shows client-side error', async ({ page }) => {
    await page.getByLabel('Nombre').fill('Test');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('test@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('differentpass');
    await page.getByRole('button', { name: 'Continuar al pago' }).click();

    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible({ timeout: 5_000 });
  });

  test('short password shows client-side error', async ({ page }) => {
    await page.getByLabel('Nombre').fill('Test');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('test@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('1234567');
    await page.getByLabel('Confirmar contraseña').fill('1234567');

    // Remove native minLength so the form actually submits and our JS validation fires
    await page.evaluate(() => {
      document.querySelectorAll('input[minlength]').forEach((el) => el.removeAttribute('minlength'));
    });
    await page.getByRole('button', { name: 'Continuar al pago' }).click();

    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible({ timeout: 5_000 });
  });

  test('server-side error is displayed', async ({ page }) => {
    await page.goto('/register?package=6');

    await page.route('**/api/auth/pre-register/**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ email: ['Ya existe una cuenta con este correo.'] }),
      });
    });

    await page.getByLabel('Nombre').fill('Test');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('existing@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('securepass123');
    await page.getByRole('button', { name: 'Continuar al pago' }).click();

    await expect(page.getByText(/Ya existe una cuenta|Error al crear la cuenta/)).toBeVisible({ timeout: 10_000 });
  });

  test('register without package redirects to programs', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Nombre').fill('New');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('newuser@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('securepass123');
    await page.getByRole('button', { name: 'Continuar al pago' }).click();

    await page.waitForURL('**/programs', { timeout: 15_000 });
  });

  test('successful pre-register with package param redirects to checkout', async ({ page }) => {
    await page.route('**/api/auth/pre-register/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registration_token: 'signed-token-e2e-123',
        }),
      });
    });

    await page.goto('/register?package=6');

    await page.getByLabel('Nombre').fill('New');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('newuser@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('securepass123');
    await page.getByRole('button', { name: 'Continuar al pago' }).click();

    await page.waitForURL(/\/checkout\?package=6/, { timeout: 15_000 });
    const sessionToken = await page.evaluate(() => sessionStorage.getItem('kore_checkout_registration_token'));
    expect(sessionToken).toBe('signed-token-e2e-123');
  });

  test('server-side string error (non-array) is displayed', async ({ page }) => {
    await page.goto('/register?package=6');

    // Return a plain string value instead of an array to exercise
    // frontend error extraction fallback.
    await page.route('**/api/auth/pre-register/**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'Ya existe una cuenta con este correo.' }),
      });
    });

    await page.getByLabel('Nombre').fill('Test');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('existing@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('securepass123');
    await page.getByRole('button', { name: 'Continuar al pago' }).click();

    await expect(page.getByText('Ya existe una cuenta con este correo. Redirigiendo a iniciar sesión...')).toBeVisible({ timeout: 10_000 });
    await page.waitForURL('**/login', { timeout: 10_000 });
  });

  test('already authenticated user is redirected', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await seedAuthenticatedCookies(page);
    await mockAuthenticatedProfile(page);
    await page.goto('/register');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });

  test('already authenticated user with package param redirects to checkout', async ({ page }) => {
    // This exercises register/page.tsx lines 43-44 (isAuthenticated + packageId redirect)
    await setupDefaultApiMocks(page);
    await seedAuthenticatedCookies(page);
    await mockAuthenticatedProfile(page);
    await page.goto('/register?package=6');
    await page.waitForURL(/\/checkout\?package=6/, { timeout: 10_000 });
  });

  test('password visibility toggle works', async ({ page }) => {
    // This exercises register/page.tsx lines 211, 224, 239 (showPassword ternary branches)
    const passwordInput = page.getByLabel('Contraseña', { exact: true });
    const confirmInput = page.getByLabel('Confirmar contraseña');

    // Initially password type
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(confirmInput).toHaveAttribute('type', 'password');

    // Click toggle button (use evaluate to bypass animation overlays)
    await page.locator('button', { hasText: 'Ver' }).evaluate((el) => (el as HTMLElement).click());

    // Now text type
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(confirmInput).toHaveAttribute('type', 'text');

    // Toggle shows 'Ocultar'
    await expect(page.locator('button', { hasText: 'Ocultar' })).toBeVisible();

    // Toggle back
    await page.locator('button', { hasText: 'Ocultar' }).evaluate((el) => (el as HTMLElement).click());
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

});
