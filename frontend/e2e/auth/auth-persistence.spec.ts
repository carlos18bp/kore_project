import { test, expect, E2E_USER, loginAsTestUser, setupDefaultApiMocks, mockCaptchaSiteKey } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Auth Persistence & Cookies', { tag: [...FlowTags.AUTH_SESSION_PERSISTENCE, RoleTags.USER] }, () => {
  test('login sets kore_token and kore_user cookies', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await loginAsTestUser(page);

    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'kore_token');
    const userCookie = cookies.find((c) => c.name === 'kore_user');

    expect(tokenCookie?.value ?? '').not.toEqual('');
    expect((tokenCookie?.value ?? '').length).toBeGreaterThan(10);

    expect(userCookie?.value ?? '').not.toEqual('');
    const userData = JSON.parse(decodeURIComponent(userCookie?.value ?? ''));
    expect(userData.email).toBe(E2E_USER.email);
    expect(userData.first_name).toBe(E2E_USER.firstName);
    expect(userData.last_name).toBe(E2E_USER.lastName);
  });

  test('page reload preserves authentication via hydrate', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await loginAsTestUser(page);
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(E2E_USER.firstName) })).toBeVisible();

    // Reload the page — hydrate should restore session from cookies
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(E2E_USER.firstName) })).toBeVisible({ timeout: 10_000 });
  });

  test('logout clears kore_token and kore_user cookies', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await loginAsTestUser(page);

    // Verify cookies exist
    let cookies = await page.context().cookies();
    const tokenBeforeLogout = cookies.find((c) => c.name === 'kore_token');
    expect(tokenBeforeLogout?.value ?? '').not.toEqual('');

    const userBeforeLogout = cookies.find((c) => c.name === 'kore_user');
    expect(userBeforeLogout?.value ?? '').not.toEqual('');

    // Logout
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/dashboard'));

    // Cookies should be cleared
    cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'kore_token');
    expect(tokenCookie?.value ?? '').toEqual('');

    const userCookie = cookies.find((c) => c.name === 'kore_user');
    expect(userCookie?.value ?? '').toEqual('');
  });

  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('login form shows loading state during submission', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await page.route('**/api/auth/login/', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tokens: {
            access: 'mock-jwt-token',
            refresh: 'mock-refresh-token',
          },
          user: {
            id: 999,
            email: E2E_USER.email,
            first_name: E2E_USER.firstName,
            last_name: E2E_USER.lastName,
            phone: '',
            role: 'customer',
          },
        }),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/Correo electrónico/i).fill(E2E_USER.email);
    await page.getByLabel(/Contraseña/i).fill(E2E_USER.password);

    // Click submit and check for loading spinner text
    const submitBtn = page.getByRole('button', { name: 'Iniciar sesión' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect(page.getByRole('button', { name: 'Ingresando...' })).toBeVisible();

    // Should redirect to dashboard eventually
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(E2E_USER.firstName) })).toBeVisible();
  });

  test('hydrate catches profile API failure and clears auth state', async ({ page }) => {
    const validUser = JSON.stringify({
      id: '999', email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba',
      phone: '', role: 'customer', name: 'Usuario Prueba',
    });
    await page.context().addCookies([
      { name: 'kore_token', value: 'valid-looking-token-for-fail-test', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: encodeURIComponent(validUser), domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/auth/profile/**', async (route) => {
      await route.fulfill({ status: 401, body: '' });
    });

    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 10_000 });

    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'kore_token');
    expect(!tokenCookie || tokenCookie.value === '').toBe(true);
  });

  test('mapUser name falls back to email when first_name and last_name are empty', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/auth/login/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tokens: { access: 'test-mapuser-token', refresh: 'test-refresh' },
          user: { id: 777, email: 'noname@kore.com', first_name: '', last_name: '', phone: '', role: 'customer' },
        }),
      });
    });
    await page.route('**/api/auth/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 777, email: 'noname@kore.com', first_name: '', last_name: '', phone: '', role: 'customer' },
        }),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/Correo electrónico/i).fill('noname@kore.com');
    await page.getByLabel(/Contraseña/i).fill('pass123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    const cookies = await page.context().cookies();
    const userCookie = cookies.find((c) => c.name === 'kore_user');
    const userData = JSON.parse(decodeURIComponent(userCookie?.value ?? '{}'));
    expect(userData.name).toBe('noname@kore.com');
  });

  test('hydrate with corrupted cookie clears auth state', async ({ page }) => {
    // Exercise the catch block in authStore.hydrate() lines 144-148
    // by setting an invalid JSON value for kore_user cookie
    await page.context().addCookies([
      { name: 'kore_token', value: 'some-fake-token', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: 'not-valid-json{{{', domain: 'localhost', path: '/' },
    ]);

    // Navigate to a protected page — hydrate runs but fails to parse user
    await page.goto('/dashboard');

    // Should be redirected to login because auth state was cleared
    await page.waitForURL('**/login', { timeout: 10_000 });

    // Verify cookies were cleared by the catch block
    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'kore_token');
    expect(!tokenCookie || tokenCookie.value === '').toBe(true);
  });
});
