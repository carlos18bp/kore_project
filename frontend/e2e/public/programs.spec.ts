import { test, expect } from '../fixtures';

const mockPackages = {
  count: 5,
  next: null,
  previous: null,
  results: [
    { id: 1, title: 'Sesión Individual', category: 'personalizado', sessions_count: 1, session_duration_minutes: 60, price: '85000.00', currency: 'COP', validity_days: 30, short_description: '', description: '', terms_and_conditions: '', is_active: true, order: 1, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    { id: 2, title: 'Programa Básico', category: 'personalizado', sessions_count: 4, session_duration_minutes: 60, price: '320000.00', currency: 'COP', validity_days: 30, short_description: '', description: '', terms_and_conditions: '', is_active: true, order: 2, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    { id: 10, title: 'Programa Inicial', category: 'semi_personalizado', sessions_count: 4, session_duration_minutes: 60, price: '240000.00', currency: 'COP', validity_days: 30, short_description: '', description: '', terms_and_conditions: '', is_active: true, order: 7, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    { id: 20, title: 'Sesión Terapéutica', category: 'terapeutico', sessions_count: 1, session_duration_minutes: 60, price: '95000.00', currency: 'COP', validity_days: 30, short_description: '', description: '', terms_and_conditions: '', is_active: true, order: 12, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    { id: 21, title: 'Programa Terapéutico', category: 'terapeutico', sessions_count: 4, session_duration_minutes: 60, price: '360000.00', currency: 'COP', validity_days: 30, short_description: '', description: '', terms_and_conditions: '', is_active: true, order: 13, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  ],
};

test.describe('Programs Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/packages/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPackages),
      });
    });
    await page.goto('/programs');
  });

  test('renders the tariff badge and default program', async ({ page }) => {
    await expect(page.getByText('Tarifas 2026')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Personalizado FLW' })).toBeVisible();
    await expect(page.getByText('Tu proceso, tu ritmo')).toBeVisible();
  });

  test('shows plans for the default Personalizado program from API', async ({ page }) => {
    await expect(page.getByText('Sesión Individual')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Programa Básico')).toBeVisible();
  });

  test('switches to Semi-personalizado tab and shows its plans', async ({ page }) => {
    await expect(page.getByText('Sesión Individual')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Semi-personalizado').first().click();
    await expect(page.getByRole('heading', { name: 'Semi-personalizado FLW' })).toBeVisible();
    await expect(page.getByText('Comparte el camino')).toBeVisible();
    await expect(page.getByText('Programa Inicial')).toBeVisible();
  });

  test('switches to Terapéutico tab and shows its plans', async ({ page }) => {
    await expect(page.getByText('Sesión Individual')).toBeVisible({ timeout: 10_000 });
    const tab = page.locator('button', { hasText: 'Terapéutico' }).first();
    await tab.click({ force: true });
    await expect(page.getByRole('heading', { name: 'Terapéutico FLW' })).toBeVisible();
    await expect(page.getByText('Movimiento como medicina')).toBeVisible();
    await expect(page.getByText('Sesión Terapéutica')).toBeVisible();
  });

  test('unauthenticated user clicking reserve is redirected to register with package ID', async ({ page }) => {
    await expect(page.getByText('Sesión Individual')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Sesión Individual').click();
    const cta = page.getByRole('button', { name: /Reservar/ });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/register\?package=1/, { timeout: 10_000 });
  });

  test('authenticated user clicking reserve is redirected to checkout with package ID', async ({ page }) => {
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

    const fakeUserCookie = encodeURIComponent(JSON.stringify({
      id: '999',
      email: 'e2e@kore.com',
      first_name: 'Usuario',
      last_name: 'Prueba',
      phone: '',
      role: 'customer',
      name: 'Usuario Prueba',
    }));

    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-token', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: fakeUserCookie, domain: 'localhost', path: '/' },
    ]);

    await page.goto('/programs');
    await expect(page.getByText('Sesión Individual')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Sesión Individual').click();

    const cta = page.getByRole('button', { name: /Reservar/ });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/checkout\?package=1/, { timeout: 10_000 });
  });

  test('switching programs resets plan selection', async ({ page }) => {
    await expect(page.getByText('Sesión Individual')).toBeVisible({ timeout: 10_000 });
    // Select a plan
    await page.getByText('Sesión Individual').click();
    await expect(page.getByRole('button', { name: /Reservar/ })).toBeVisible();

    // Switch program
    await page.getByText('Semi-personalizado').first().click();

    // CTA should disappear
    await expect(page.getByRole('button', { name: /Reservar/ })).not.toBeVisible();
  });

  test('API fetch error shows empty plans state', async ({ page }) => {
    // Override the packages route to return an error (exercises line 97)
    await page.route('**/api/packages/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Server error' }),
      });
    });

    await page.goto('/programs');

    // Page should still render with the program header
    await expect(page.getByRole('heading', { name: 'Personalizado FLW' })).toBeVisible({ timeout: 10_000 });

    // Should show "no plans available" message
    await expect(page.getByText('No hay planes disponibles para este programa.')).toBeVisible();
  });
});
