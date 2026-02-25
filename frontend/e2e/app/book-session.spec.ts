import { test, expect, mockLoginAsTestUser, mockCaptchaSiteKey } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Book Session Page', { tag: [...FlowTags.BOOKING_SESSION_PAGE, RoleTags.USER] }, () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/book-session');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user sees the booking page heading', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });

  test('booking page renders step indicator', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Seleccionar horario')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Confirmar')).toBeVisible();
  });

  test('booking page shows calendar and placeholder text', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Selecciona una fecha en el calendario/)).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar link navigates to book-session', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.locator('aside').getByRole('link', { name: 'Agendar Sesión' }).click();
    await page.waitForURL('**/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });
});
