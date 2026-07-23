import { test, expect, setupDefaultApiMocks, mockCaptchaSiteKey } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Register page (/register).
 * Covers pre-register validation and redirect to checkout flow.
 */
test.describe('Register Page', { tag: [...FlowTags.AUTH_REGISTER, RoleTags.GUEST] }, () => {
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

  test('renders register page heading and primary actions', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/register');

    await expect(page.getByText('Crea tu cuenta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inicia sesión' })).toBeVisible();
  });

  test('renders register personal info inputs', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/register');

    await expect(page.getByLabel('Nombre')).toBeVisible();
    await expect(page.getByLabel('Apellido')).toBeVisible();
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/Teléfono/i)).toBeVisible();
  });

  test('renders register password inputs', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/register');

    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirmar contraseña')).toBeVisible();
  });

  test('password mismatch shows client-side error', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/register');
    await page.getByLabel('Nombre').fill('Test');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('test@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('differentpass');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible({ timeout: 5_000 });
  });

  test('short password shows client-side error', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/register');
    await page.getByLabel('Nombre').fill('Test');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('test@example.com');
    const password = page.getByLabel('Contraseña', { exact: true });
    await password.fill('1234567');
    await page.getByLabel('Confirmar contraseña').fill('1234567');

    await page.getByRole('button', { name: 'Continuar' }).click();

    // What a real user hits first is the browser's own minLength guard: the form
    // never submits, so the app's JS message is unreachable and the step stands.
    await expect(password).toHaveJSProperty('validity.tooShort', true);
    await expect(page.getByLabel('Confirmar contraseña')).toBeVisible();
  });

  test('server-side error is displayed', async ({ page }) => {
    await mockCaptchaSiteKey(page);
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
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText(/Ya existe una cuenta|Error al crear la cuenta/)).toBeVisible({ timeout: 10_000 });
  });

  test('register without package proceeds to verification step', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.route('**/api/auth/pre-register/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verification_pending: true, pre_registration_token: 'fake-pre-reg-token' }),
      });
    });
    await page.goto('/register');

    await page.getByLabel('Nombre').fill('New');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('newuser@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('securepass123');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Verifica tu correo')).toBeVisible({ timeout: 15_000 });
  });

  test('successful pre-register with package param shows verification step', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.route('**/api/auth/pre-register/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verification_pending: true,
          pre_registration_token: 'signed-pre-token-e2e-123',
        }),
      });
    });

    await page.goto('/register?package=6');

    await page.getByLabel('Nombre').fill('New');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('newuser@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('securepass123');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText(/Enviamos un código de 6 dígitos/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verificar código' })).toBeVisible();
    await expect(page.getByText('Reenviar código')).toBeVisible();
  });

  test('server-side string error (non-array) is displayed', async ({ page }) => {
    await mockCaptchaSiteKey(page);
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
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Ya existe una cuenta con este correo. Redirigiendo a iniciar sesión...')).toBeVisible({ timeout: 10_000 });
    await page.waitForURL('**/login', { timeout: 10_000 });
  });

  test('already authenticated user is redirected', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await seedAuthenticatedCookies(page);
    await mockAuthenticatedProfile(page);
    await page.goto('/register');
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/, { timeout: 20_000 });
  });

  test('already authenticated user with package param redirects to checkout', async ({ page }) => {
    // This exercises register/page.tsx lines 43-44 (isAuthenticated + packageId redirect)
    await setupDefaultApiMocks(page);
    await seedAuthenticatedCookies(page);
    await mockAuthenticatedProfile(page);
    await page.goto('/register?package=6');
    await expect(page).toHaveURL(/\/checkout\?package=6$/, { timeout: 20_000 });
  });

  test('password visibility toggle works', async ({ page }) => {
    // This exercises register/page.tsx lines 211, 224, 239 (showPassword ternary branches)
    await mockCaptchaSiteKey(page);
    await page.goto('/register');
    const passwordInput = page.getByLabel('Contraseña', { exact: true });
    const confirmInput = page.getByLabel('Confirmar contraseña');

    // Initially password type
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(confirmInput).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Ver', exact: true }).click();

    // Now text type
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(confirmInput).toHaveAttribute('type', 'text');

    // Toggle shows 'Ocultar'
    await expect(page.getByRole('button', { name: 'Ocultar', exact: true })).toBeVisible();

    // Toggle back
    await page.getByRole('button', { name: 'Ocultar', exact: true }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

});
