import type { Page } from '@playwright/test';
import { test, expect, mockCaptchaSiteKey, mockAuthProfile, mockLoginApi } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const FAKE_TOKEN = 'fake-e2e-jwt-token-for-testing';

async function injectMustChangePasswordCookies(page: Page) {
  await mockLoginApi(page);
  await mockCaptchaSiteKey(page);
  const userCookie = JSON.stringify({
    id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba',
    phone: '', role: 'customer', name: 'Usuario Prueba', profile_completed: true,
    avatar_url: null, must_change_password: true, assigned_trainer: null,
  });
  await page.context().addCookies([
    { name: 'kore_token', value: FAKE_TOKEN, url: 'http://localhost:3000' },
    { name: 'kore_user', value: encodeURIComponent(userCookie), url: 'http://localhost:3000' },
  ]);
  // Override profile endpoint to reflect must_change_password: true
  await page.route('**/api/auth/profile/', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba',
          phone: '', role: 'customer', profile_completed: true, avatar_url: null,
          must_change_password: true, assigned_trainer: null,
          customer_profile: { profile_completed: true, sex: 'M', date_of_birth: '1990-01-15', city: 'Bogotá', primary_goal: 'health' },
          today_mood: null,
        },
      }),
    });
  });
}

test.describe('Forced Password Change', { tag: [...FlowTags.AUTH_FORCED_PASSWORD_CHANGE, RoleTags.USER] }, () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/change-password-required');

    await page.waitForURL('**/login', { timeout: 15_000 });
  });

  test('user with must_change_password=false is redirected to dashboard', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await mockAuthProfile(page);
    const userCookie = JSON.stringify({
      id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba',
      phone: '', role: 'customer', name: 'Usuario Prueba', profile_completed: true,
      avatar_url: null, must_change_password: false, assigned_trainer: null,
    });
    await page.context().addCookies([
      { name: 'kore_token', value: FAKE_TOKEN, url: 'http://localhost:3000' },
      { name: 'kore_user', value: encodeURIComponent(userCookie), url: 'http://localhost:3000' },
    ]);
    await page.goto('/change-password-required');

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
  });

  test('page shows Cambia tu contraseña heading', async ({ page }) => {
    await injectMustChangePasswordCookies(page);
    await page.goto('/change-password-required');

    await expect(page.getByRole('heading', { name: 'Cambia tu contraseña' })).toBeVisible({ timeout: 15_000 });
  });

  test('empty form submission shows Requerido error', async ({ page }) => {
    await injectMustChangePasswordCookies(page);
    await page.goto('/change-password-required');

    await expect(page.getByRole('button', { name: 'Cambiar contraseña' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByText('Requerido').first()).toBeVisible({ timeout: 5_000 });
  });

  test('new password too short shows Mínimo 8 caracteres error', async ({ page }) => {
    await injectMustChangePasswordCookies(page);
    await page.goto('/change-password-required');

    const inputs = page.locator('input[type="password"]');
    await expect(inputs.first()).toBeVisible({ timeout: 10_000 });
    await inputs.nth(0).fill('temp1234');
    await inputs.nth(1).fill('short');
    await inputs.nth(2).fill('short');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByText('Mínimo 8 caracteres')).toBeVisible({ timeout: 5_000 });
  });

  test('successful change redirects customer to /dashboard', async ({ page }) => {
    await injectMustChangePasswordCookies(page);
    await page.route('**/api/auth/change-password/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.goto('/change-password-required');

    const inputs = page.locator('input[type="password"]');
    await expect(inputs.first()).toBeVisible({ timeout: 10_000 });
    await inputs.nth(0).fill('TempPass1!');
    await inputs.nth(1).fill('NewPass123!');
    await inputs.nth(2).fill('NewPass123!');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
  });
});
