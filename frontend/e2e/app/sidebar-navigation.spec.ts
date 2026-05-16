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

    // Bottom nav should be visible with the 4 customer tabs (booking moved to dashboard CTA).
    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByText('Inicio')).toBeVisible();
    await expect(bottomNav.getByText('Programa')).toBeVisible();
    await expect(bottomNav.getByText('Nutrición')).toBeVisible();
    await expect(bottomNav.getByText('Perfil')).toBeVisible();
    await expect(bottomNav.getByText('Agendar')).not.toBeVisible();
  });

  test('sidebar shows user info, logo, soporte, and active link highlighting', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const sidebar = page.locator('aside');

    // User name and KÓRE logo
    await expect(sidebar.getByText('Usuario Prueba')).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'KÓRE' })).toBeVisible();

    // Soporte link
    await expect(sidebar.getByText('Soporte')).toBeVisible();

    // The sidebar must NOT include the booking entry — booking lives only on the dashboard CTA.
    await expect(sidebar.getByRole('link', { name: 'Agendar Sesión' })).toHaveCount(0);

    // On /dashboard — "Inicio" should be active.
    // AppSidebar marks active items with the gradient bg `from-kore-petal/...` —
    // a class that is unique to the active state.
    const inicioLink = sidebar.getByRole('link', { name: 'Inicio' });
    await expect(inicioLink).toHaveClass(/from-kore-petal/);

    // Navigate to /subscription — "Mi Suscripción" should be active
    await sidebar.getByRole('link', { name: 'Mi Suscripción' }).click();
    await page.waitForURL('**/subscription');
    const subscriptionLink = sidebar.getByRole('link', { name: 'Mi Suscripción' });
    await expect(subscriptionLink).toHaveClass(/from-kore-petal/);
  });
});
