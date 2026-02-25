import { test, expect, E2E_USER, mockLoginApi, setupDefaultApiMocks, mockCaptchaSiteKey, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Login Page', { tag: [...FlowTags.AUTH_LOGIN, RoleTags.GUEST] }, () => {
  async function openLoginPage(page: import('@playwright/test').Page) {
    await mockCaptchaSiteKey(page);
    await page.goto('/login');
  }

  test('renders the login form with brand name', async ({ page }) => {
    await openLoginPage(page);
    await expect(page.getByRole('link', { name: 'KÓRE', exact: true })).toBeVisible();
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/Contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.route('**/api/auth/login/', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ non_field_errors: ['Credenciales inválidas.'] }),
      });
    });

    await openLoginPage(page);

    await page.getByLabel(/Correo electrónico/i).fill('wrong@email.com');
    await page.getByLabel(/Contraseña/i).fill('wrongpass');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByText('Credenciales inválidas.')).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await mockLoginApi(page);
    await openLoginPage(page);

    await page.getByLabel(/Correo electrónico/i).fill(E2E_USER.email);
    await page.getByLabel(/Contraseña/i).fill(E2E_USER.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await page.waitForURL('**/dashboard');
    await expect(page.getByText(`Hola, ${E2E_USER.firstName}`)).toBeVisible();
  });

  test('toggle password visibility works', async ({ page }) => {
    await openLoginPage(page);
    const passwordInput = page.getByLabel(/Contraseña/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Use evaluate to bypass GSAP animation overlay
    await page.locator('button', { hasText: 'Ver' }).evaluate((el) => (el as HTMLElement).click());
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.locator('button', { hasText: 'Ocultar' }).evaluate((el) => (el as HTMLElement).click());
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('already authenticated user is redirected to dashboard', async ({ page }) => {
    // Use mockLoginAsTestUser to inject cookies directly (bypasses form login)
    await mockLoginAsTestUser(page);

    // Navigate to login - should redirect to dashboard since user is already authenticated
    await page.goto('/login');

    // Should be redirected back to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page.getByText(`Hola, ${E2E_USER.firstName}`)).toBeVisible();
  });

  test('shows error with detail field instead of non_field_errors', async ({ page }) => {
    // Exercise the axiosErr.response?.data?.detail branch in authStore.login()
    await page.route('**/api/auth/login/', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Cuenta deshabilitada.' }),
      });
    });

    await openLoginPage(page);

    await page.getByLabel(/Correo electrónico/i).fill('disabled@example.com');
    await page.getByLabel(/Contraseña/i).fill('somepass');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByText('Cuenta deshabilitada.')).toBeVisible({ timeout: 10_000 });
  });

  test('shows fallback error when detail is non-string', async ({ page }) => {
    // Exercise the typeof message !== 'string' fallback branch in authStore.login()
    await page.route('**/api/auth/login/', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: { code: 'AUTH_ERROR' } }),
      });
    });

    await openLoginPage(page);

    await page.getByLabel(/Correo electrónico/i).fill('test@example.com');
    await page.getByLabel(/Contraseña/i).fill('wrongpass');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByText('Correo o contraseña incorrectos')).toBeVisible({ timeout: 10_000 });
  });
});
