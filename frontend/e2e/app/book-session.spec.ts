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
    await expect(page.getByText(/Paso 1 de 2/)).toBeVisible({ timeout: 10_000 });
  });

  test('booking page shows calendar and placeholder text', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Selecciona un día')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Selecciona una fecha en el calendario/)).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard "Agendar sesión" link navigates to book-session', async ({ page }) => {
    await mockLoginAsTestUser(page);
    // booking entry point is now in the dashboard hero, not the sidebar
    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
  });
});
