import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Forgot Password page (/forgot-password).
 * Covers the 3-step password reset: request code → verify code → set new password.
 */
test.describe('Forgot Password Page', { tag: [...FlowTags.AUTH_FORGOT_PASSWORD, RoleTags.GUEST] }, () => {

  test('renders step 1 with email input and submit button', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
    await expect(page.getByText('Ingresa tu correo y te enviaremos un código de verificación.')).toBeVisible();
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar código' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver a iniciar sesión' })).toBeVisible();
  });

  test('submit email advances to step 2 code entry', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();

    await expect(page.getByRole('heading', { name: 'Ingresa el código' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Si el correo existe, recibirás un código de 6 dígitos.')).toBeVisible();
    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible();
    await expect(page.getByText('user@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verificar código' })).toBeVisible();
  });

  test('request code API failure shows error message', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Server error"}' });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();

    await expect(page.getByText('Error al enviar el código. Intenta de nuevo.')).toBeVisible({ timeout: 10_000 });
  });

  test('valid code advances to step 3 password entry', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/api/auth/password-reset/verify-code/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'fake-reset-token-123' }),
      });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();

    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Código de verificación/i).fill('123456');
    await page.getByRole('button', { name: 'Verificar código' }).click();

    await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Nueva contraseña')).toBeVisible();
    await expect(page.getByLabel('Confirmar contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cambiar contraseña' })).toBeVisible();
  });

  test('invalid code shows error and stays on step 2', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/api/auth/password-reset/verify-code/', async (route) => {
      await route.fulfill({ status: 400, contentType: 'application/json', body: '{"detail":"Invalid code"}' });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();

    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Código de verificación/i).fill('000000');
    await page.getByRole('button', { name: 'Verificar código' }).click();

    await expect(page.getByText('Código inválido o expirado. Verifica e intenta de nuevo.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Ingresa el código' })).toBeVisible();
  });

  test('"Volver a enviar código" returns to step 1', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();

    await expect(page.getByRole('heading', { name: 'Ingresa el código' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Volver a enviar código' }).click();

    await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
  });

  test('password mismatch shows validation error on step 3', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/api/auth/password-reset/verify-code/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'fake-reset-token-123' }),
      });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Código de verificación/i).fill('123456');
    await page.getByRole('button', { name: 'Verificar código' }).click();

    await expect(page.getByLabel('Nueva contraseña')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Nueva contraseña').fill('securepass1');
    await page.getByLabel('Confirmar contraseña').fill('differentpass');

    await page.evaluate(() => {
      document.querySelectorAll('input[minlength]').forEach((el) => el.removeAttribute('minlength'));
    });
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible({ timeout: 5_000 });
  });

  test('short password shows validation error on step 3', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/api/auth/password-reset/verify-code/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'fake-reset-token-123' }),
      });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Código de verificación/i).fill('123456');
    await page.getByRole('button', { name: 'Verificar código' }).click();

    await expect(page.getByLabel('Nueva contraseña')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Nueva contraseña').fill('short');
    await page.getByLabel('Confirmar contraseña').fill('short');

    await page.evaluate(() => {
      document.querySelectorAll('input[minlength]').forEach((el) => el.removeAttribute('minlength'));
    });
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible({ timeout: 5_000 });
  });

  test('successful password reset shows success and redirects to login', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/api/auth/password-reset/verify-code/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'fake-reset-token-123' }),
      });
    });
    await page.route('**/api/auth/password-reset/reset/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Código de verificación/i).fill('123456');
    await page.getByRole('button', { name: 'Verificar código' }).click();

    await expect(page.getByLabel('Nueva contraseña')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Nueva contraseña').fill('newsecurepass123');
    await page.getByLabel('Confirmar contraseña').fill('newsecurepass123');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByText('¡Contraseña actualizada! Redirigiendo al login...')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('reset API failure shows error detail on step 3', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/api/auth/password-reset/verify-code/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'fake-reset-token-123' }),
      });
    });
    await page.goto('/forgot-password');

    // Register reset mock AFTER goto so it takes LIFO priority over the fallback
    await page.route('**/auth/password-reset/reset/', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Token expirado o inválido.' }),
      });
    });

    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Código de verificación/i).fill('123456');
    await page.getByRole('button', { name: 'Verificar código' }).click();

    await expect(page.getByLabel('Nueva contraseña')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Nueva contraseña').fill('newsecurepass123');
    await page.getByLabel('Confirmar contraseña').fill('newsecurepass123');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByText('Token expirado o inválido.')).toBeVisible({ timeout: 10_000 });
  });

  test('password visibility toggle works on step 3', async ({ page }) => {
    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/api/auth/password-reset/verify-code/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'fake-reset-token-123' }),
      });
    });

    await page.goto('/forgot-password');
    await page.getByLabel(/Correo electrónico/i).fill('user@example.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByLabel(/Código de verificación/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Código de verificación/i).fill('123456');
    await page.getByRole('button', { name: 'Verificar código' }).click();

    const passwordInput = page.getByLabel('Nueva contraseña');
    await expect(passwordInput).toBeVisible({ timeout: 10_000 });
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.locator('button', { hasText: 'Ver' }).evaluate((el) => (el as HTMLElement).click());
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.locator('button', { hasText: 'Ocultar' }).evaluate((el) => (el as HTMLElement).click());
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('"Volver a iniciar sesión" link navigates to login', async ({ page }) => {
    await page.goto('/forgot-password');
    const link = page.getByRole('link', { name: 'Volver a iniciar sesión' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/login');
  });
});
