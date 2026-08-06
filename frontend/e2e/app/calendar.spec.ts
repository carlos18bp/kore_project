import { test, expect, mockLoginAsTestUser, mockCaptchaSiteKey } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Calendar Page (redirect)', { tag: [...FlowTags.BOOKING_CALENDAR_REDIRECT, RoleTags.USER] }, () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/calendar');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user is redirected from /calendar to /book-session', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await mockLoginAsTestUser(page);
    await page.goto('/calendar');
    await page.waitForURL('**/book-session');
    await expect(page).toHaveURL(/\/book-session/);
  });
});
