import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the customer mobile bottom navigation (MobileBottomNav).
 *
 * Hidden via xl:hidden on desktop, so all tests use a mobile viewport.
 * Covers the 4 direct tabs: Inicio, Programa, Nutrición, Perfil.
 * Booking is reached from the dashboard CTA (SessionCard), not from this nav.
 */
test.describe('Mobile Bottom Navigation (Customer)', { tag: [...FlowTags.MOBILE_BOTTOM_NAV, RoleTags.USER] }, () => {

  // iPhone 13/14 viewport — under xl breakpoint (1280px) so MobileBottomNav renders
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
  });

  test('renders all four bottom tabs on a mobile viewport', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await expect(nav.getByText('Inicio')).toBeVisible();
    await expect(nav.getByText('Programa')).toBeVisible();
    await expect(nav.getByText('Nutrición')).toBeVisible();
    await expect(nav.getByText('Perfil')).toBeVisible();
    await expect(nav.getByText('Agendar')).not.toBeVisible();
  });

  test('renders no sheet-trigger buttons', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await expect(nav.getByText('Evaluar')).not.toBeVisible();
    await expect(nav.getByText('Más')).not.toBeVisible();
  });

  test('Programa tab navigates to /mi-programa', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('link', { name: /Programa/ }).click();
    await page.waitForURL('**/mi-programa', { timeout: 15_000 });
  });

  test('Nutrición tab navigates to /my-nutrition', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('link', { name: /Nutrición/ }).click();
    await page.waitForURL('**/my-nutrition', { timeout: 15_000 });
  });

  test('Perfil tab navigates to /profile', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('link', { name: /Perfil/ }).click();
    await page.waitForURL('**/profile', { timeout: 15_000 });
  });
});
