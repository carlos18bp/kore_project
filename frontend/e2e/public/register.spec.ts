import { test, expect, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';

/**
 * E2E tests for the Register page (/register).
 * Covers authStore.register() and register page form validation/submission.
 */
test.describe('Register Page', () => {
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
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inicia sesión' })).toBeVisible();
  });

  test('password mismatch shows client-side error', async ({ page }) => {
    await page.getByLabel('Nombre').fill('Test');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('test@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('differentpass');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

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
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible({ timeout: 5_000 });
  });

  test('server-side error is displayed', async ({ page }) => {
    await page.route('**/api/auth/register/**', async (route) => {
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
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText(/Ya existe una cuenta|Error al crear la cuenta/)).toBeVisible({ timeout: 10_000 });
  });

  test('successful registration redirects to dashboard', async ({ page }) => {
    await page.route('**/api/auth/register/**', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 999, email: 'newuser@example.com', first_name: 'New', last_name: 'User' },
          tokens: { access: 'mock-access-token', refresh: 'mock-refresh-token' },
        }),
      });
    });

    await page.getByLabel('Nombre').fill('New');
    await page.getByLabel('Apellido').fill('User');
    await page.getByLabel(/Correo electrónico/i).fill('newuser@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('securepass123');
    await page.getByLabel('Confirmar contraseña').fill('securepass123');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
  });

  test('server-side string error (non-array) is displayed', async ({ page }) => {
    // Return a plain string value instead of an array to exercise the
    // `typeof firstError === 'string'` branch in authStore.register()
    await page.route('**/api/auth/register/**', async (route) => {
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
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText('Ya existe una cuenta con este correo.')).toBeVisible({ timeout: 10_000 });
  });

  test('already authenticated user is redirected', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await loginAsTestUser(page);
    await page.goto('/register');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });
});
