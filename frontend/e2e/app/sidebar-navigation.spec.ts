import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('Sidebar — Navigation & Active States', () => {
  test.describe.configure({ mode: 'serial' });

  test('mobile sidebar opens with hamburger and closes with backdrop click', async ({ page }) => {
    // Set mobile viewport to test mobile-specific sidebar behavior (lines 77-85)
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsTestUser(page);

    const sidebar = page.locator('aside');

    // Sidebar should have -translate-x-full class on mobile (hidden)
    await expect(sidebar).toHaveClass(/-translate-x-full/);

    // Click hamburger button to open sidebar
    await page.getByRole('button', { name: 'Abrir menú' }).click();

    // Sidebar should have translate-x-0 class (visible)
    await expect(sidebar).toHaveClass(/translate-x-0/);

    // Backdrop should be visible
    const backdrop = page.locator('div.fixed.inset-0.bg-black\\/30');
    await expect(backdrop).toBeVisible();

    // Click backdrop to close sidebar (exercises line 80)
    // Click on the right side of the viewport to avoid the sidebar (which is 256px wide)
    await backdrop.click({ position: { x: 350, y: 300 } });

    // Sidebar should be hidden again
    await expect(sidebar).toHaveClass(/-translate-x-full/);
  });

  test('mobile sidebar closes with close button', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsTestUser(page);

    const sidebar = page.locator('aside');

    // Open sidebar
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(sidebar).toHaveClass(/translate-x-0/);

    // Click close button inside sidebar (exercises line 95)
    await page.getByRole('button', { name: 'Cerrar menú' }).click();

    // Sidebar should be hidden
    await expect(sidebar).toHaveClass(/-translate-x-full/);
  });

  test('sidebar shows user info, logo, soporte, and active link highlighting', async ({ page }) => {
    await loginAsTestUser(page);
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

    // Navigate to /my-programs — "Mis Programas" should be active
    await sidebar.getByRole('link', { name: 'Mis Programas' }).click();
    await page.waitForURL('**/my-programs');
    const programasLink = sidebar.getByRole('link', { name: 'Mis Programas' });
    await expect(programasLink).toHaveAttribute('class', /text-kore-red/);
  });
});
