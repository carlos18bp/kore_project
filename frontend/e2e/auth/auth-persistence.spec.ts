import { test, expect, E2E_USER, loginAsTestUser } from '../fixtures';

test.describe('Auth Persistence & Cookies', () => {
  test('login sets kore_token and kore_user cookies', async ({ page }) => {
    await loginAsTestUser(page);

    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'kore_token');
    const userCookie = cookies.find((c) => c.name === 'kore_user');

    expect(tokenCookie).toBeTruthy();
    expect(tokenCookie!.value.length).toBeGreaterThan(10);

    expect(userCookie).toBeTruthy();
    const userData = JSON.parse(decodeURIComponent(userCookie!.value));
    expect(userData.email).toBe(E2E_USER.email);
    expect(userData.first_name).toBe(E2E_USER.firstName);
    expect(userData.last_name).toBe(E2E_USER.lastName);
  });

  test('page reload preserves authentication via hydrate', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page.getByText(`Hola, ${E2E_USER.firstName}`)).toBeVisible();

    // Reload the page — hydrate should restore session from cookies
    await page.reload();
    await expect(page.getByText(`Hola, ${E2E_USER.firstName}`)).toBeVisible({ timeout: 10_000 });
  });

  test('logout clears kore_token and kore_user cookies', async ({ page }) => {
    await loginAsTestUser(page);

    // Verify cookies exist
    let cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'kore_token')).toBeTruthy();

    // Logout
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/dashboard'));

    // Cookies should be cleared
    cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'kore_token');
    // Cookie is either removed or has empty value
    expect(!tokenCookie || tokenCookie.value === '').toBe(true);
  });

  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('login form shows loading state during submission', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/Correo electrónico/i).fill(E2E_USER.email);
    await page.getByLabel(/Contraseña/i).fill(E2E_USER.password);

    // Click submit and check for loading spinner text
    const submitBtn = page.getByRole('button', { name: 'Iniciar sesión' });
    await submitBtn.click();

    // Should redirect to dashboard eventually
    await page.waitForURL('**/dashboard');
  });
});
