import { test, expect, E2E_USER, loginAsTestUser } from '../fixtures';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the login form with brand name', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'KÓRE', exact: true })).toBeVisible();
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/Contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.getByLabel(/Correo electrónico/i).fill('wrong@email.com');
    await page.getByLabel(/Contraseña/i).fill('wrongpass');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByText('Invalid credentials.')).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.getByLabel(/Correo electrónico/i).fill(E2E_USER.email);
    await page.getByLabel(/Contraseña/i).fill(E2E_USER.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await page.waitForURL('**/dashboard');
    await expect(page.getByText(`Hola, ${E2E_USER.firstName}`)).toBeVisible();
  });

  test('toggle password visibility works', async ({ page }) => {
    const passwordInput = page.getByLabel(/Contraseña/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Use evaluate to bypass GSAP animation overlay
    await page.locator('button', { hasText: 'Ver' }).evaluate((el) => (el as HTMLElement).click());
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.locator('button', { hasText: 'Ocultar' }).evaluate((el) => (el as HTMLElement).click());
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('already authenticated user is redirected to dashboard', async ({ page }) => {
    await loginAsTestUser(page);

    // Navigate back to login
    await page.goto('/login');

    // Should be redirected back to dashboard
    await page.waitForURL('**/dashboard');
  });
});
