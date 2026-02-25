import { test, expect, mockLoginAsTestUser, mockCaptchaSiteKey } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Calendar Page (redirect)', { tag: [...FlowTags.BOOKING_CALENDAR_REDIRECT, RoleTags.USER] }, () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/calendar');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user is redirected from /calendar to /book-session', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/calendar');
    await page.waitForURL('**/book-session');
    await expect(page).toHaveURL(/\/book-session/);
  });
});
