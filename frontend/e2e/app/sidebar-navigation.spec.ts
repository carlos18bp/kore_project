import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Sidebar — Navigation & Active States', { tag: [...FlowTags.APP_SIDEBAR_NAVIGATION, RoleTags.USER] }, () => {
  test.describe.configure({ mode: 'serial' });

  test('mobile bottom nav renders 5 tabs and sidebar is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockLoginAsTestUser(page);

    // Sidebar should be hidden on mobile (hidden xl:flex)
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();

    // Bottom nav should be visible with all 5 tabs
    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByText('Inicio')).toBeVisible();
    await expect(bottomNav.getByText('Agendar')).toBeVisible();
    await expect(bottomNav.getByText('Evaluar')).toBeVisible();
    await expect(bottomNav.getByText('Perfil')).toBeVisible();
    await expect(bottomNav.getByText('Más')).toBeVisible();
  });

  test('mobile bottom nav Evaluar tab opens bottom sheet with evaluations', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockLoginAsTestUser(page);

    // Click Evaluar tab to open bottom sheet
    const bottomNav = page.locator('nav.fixed.bottom-0');
    await bottomNav.getByText('Evaluar').click();

    // Bottom sheet should show the 3 evaluation options (use getByRole to avoid sidebar duplicates)
    await expect(page.getByRole('button', { name: 'Mi Diagnóstico' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Evaluación Postural' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Evaluación Física' })).toBeVisible();
  });

  test('sidebar shows user info, logo, soporte, and active link highlighting', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const sidebar = page.locator('aside');

    // User name and KÓRE logo
    await expect(sidebar.getByText('Usuario Prueba')).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'KÓRE' })).toBeVisible();

    // Soporte link
    await expect(sidebar.getByText('Soporte')).toBeVisible();

    // On /dashboard — "Inicio" should be active (has text-kore-red class)
    const inicioLink = page.getByRole('link', { name: 'Inicio' });
    await expect(inicioLink).toHaveAttribute('class', /text-kore-red/);

    // Navigate to /book-session — "Agendar Sesión" should be active
    await sidebar.getByRole('link', { name: 'Agendar Sesión' }).click();
    await page.waitForURL('**/book-session');
    const agendarLink = sidebar.getByRole('link', { name: 'Agendar Sesión' });
    await expect(agendarLink).toHaveAttribute('class', /text-kore-red/);

    // Navigate to /subscription — "Mi Suscripción" should be active
    await sidebar.getByRole('link', { name: 'Mi Suscripción' }).click();
    await page.waitForURL('**/subscription');
    const subscriptionLink = sidebar.getByRole('link', { name: 'Mi Suscripción' });
    await expect(subscriptionLink).toHaveAttribute('class', /text-kore-red/);
  });
});
