import { test, expect, loginAsTestUser } from '../fixtures';

test.describe('Book Session Page', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/book-session');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user sees the booking page heading', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible();
  });

  test('booking page renders step indicator', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Seleccionar horario')).toBeVisible();
    await expect(page.getByText('Confirmar')).toBeVisible();
  });

  test('booking page shows calendar and placeholder text', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible();
    await expect(page.getByText(/Selecciona una fecha en el calendario/)).toBeVisible();
  });

  test('sidebar link navigates to book-session', async ({ page }) => {
    await loginAsTestUser(page);
    await page.getByRole('link', { name: 'Agendar Sesión' }).click();
    await page.waitForURL('**/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible();
  });
});
