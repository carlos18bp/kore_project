import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('Sidebar — Navigation & Active States', () => {
  test.describe.configure({ mode: 'serial' });

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

    // Navigate to /my-sessions — "Mis Sesiones" should be active
    await sidebar.getByRole('link', { name: 'Mis Sesiones' }).click();
    await page.waitForURL('**/my-sessions');
    const sesionesLink = sidebar.getByRole('link', { name: 'Mis Sesiones' });
    await expect(sesionesLink).toHaveAttribute('class', /text-kore-red/);
  });
});
