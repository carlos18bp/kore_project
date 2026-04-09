import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the customer mobile bottom navigation (MobileBottomNav).
 *
 * Hidden via xl:hidden on desktop, so all tests use a mobile viewport.
 * Covers the 5 fixed tabs (Inicio, Agendar, Evaluar, Perfil, Más), the
 * "Evaluaciones" and "Más" bottom sheets, and the logout action.
 */
test.describe('Mobile Bottom Navigation (Customer)', { tag: [...FlowTags.MOBILE_BOTTOM_NAV, RoleTags.USER] }, () => {

  // iPhone 13/14 viewport — under xl breakpoint (1280px) so MobileBottomNav renders
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
  });

  test('renders all five bottom tabs on a mobile viewport', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await expect(nav.getByText('Inicio')).toBeVisible();
    await expect(nav.getByText('Agendar')).toBeVisible();
    await expect(nav.getByText('Evaluar')).toBeVisible();
    await expect(nav.getByText('Perfil')).toBeVisible();
    await expect(nav.getByText('Más')).toBeVisible();
  });

  test('Agendar tab navigates to /book-session', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('link', { name: /Agendar/ }).click();
    await page.waitForURL('**/book-session', { timeout: 15_000 });
  });

  test('Perfil tab navigates to /profile', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('link', { name: /Perfil/ }).click();
    await page.waitForURL('**/profile', { timeout: 15_000 });
  });

  test('Evaluar tab opens evaluations bottom sheet with assessment items', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });

    await nav.getByRole('button', { name: /Evaluar/ }).click();

    // Sheet items render — these are unique to the bottom sheet
    await expect(page.getByRole('button', { name: /Mi Diagnóstico/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Evaluación Postural/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Evaluación Física/ })).toBeVisible();
  });

  test('Más tab opens more sheet with subscription, nutrition, parq and logout', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });

    await nav.getByRole('button', { name: /Más/ }).click();

    await expect(page.getByText('Más opciones')).toBeVisible();
    await expect(page.getByRole('button', { name: /Mi Nutrición/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /PAR-Q/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mi Suscripción/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cerrar sesión/ })).toBeVisible();
  });

  test('Cerrar sesión from Más sheet logs out and returns to home', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });

    await nav.getByRole('button', { name: /Más/ }).click();
    const logoutBtn = page.getByRole('button', { name: /Cerrar sesión/ });
    await expect(logoutBtn).toBeVisible();

    await logoutBtn.click();
    // Logout calls router.push('/') + clears auth; ProtectedRoute guard may
    // race to redirect to /login. Either landing page indicates a successful logout.
    await expect(page).toHaveURL(/\/(login)?$/, { timeout: 15_000 });
  });
});
