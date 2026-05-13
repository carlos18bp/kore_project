import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Profile Password Change flow (/profile → Security section).
 * Covers requesting a verification code, error handling, and modal interaction.
 */
test.describe('Profile Password Change', { tag: [...FlowTags.PROFILE_PASSWORD_CHANGE, RoleTags.USER] }, () => {

  const richProfile = {
    user: {
      id: 999,
      email: 'e2e@kore.com',
      first_name: 'Usuario',
      last_name: 'Prueba',
      phone: '3001234567',
      role: 'customer',
      profile_completed: true,
      avatar_url: null,
      customer_profile: {
        profile_completed: true,
        sex: 'masculino',
        date_of_birth: '1990-01-15',
        city: 'Bogotá',
        eps: 'Sura',
        primary_goal: 'fat_loss',
        address: 'Calle 93 #11-26',
        id_type: 'cc',
        id_number: '1234567890',
        id_expedition_date: '2010-05-20',
        avatar_url: null,
        kore_start_date: '2025-06-01',
      },
      today_mood: { score: 7, notes: '', date: new Date().toISOString().slice(0, 10) },
    },
  };

  async function goToProfile(page: import('@playwright/test').Page) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/auth/profile/', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(richProfile),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(richProfile),
        });
      }
    });
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible({ timeout: 15_000 });
  }

  test('security section shows change password button', async ({ page }) => {
    await goToProfile(page);

    await expect(page.getByText('Seguridad')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cambiar contraseña/i })).toBeVisible();
  });

  test('clicking change password requests verification code via API', async ({ page }) => {
    let requestCodeCalled = false;
    await goToProfile(page);

    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      requestCodeCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.getByRole('button', { name: /Cambiar contraseña/i }).click();

    await expect(page.getByRole('heading', { name: 'Ingresa el código' })).toBeVisible({ timeout: 10_000 });
    expect(requestCodeCalled).toBe(true);
  });

  test('request code API failure shows error message', async ({ page }) => {
    await goToProfile(page);

    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Error interno del servidor' }),
      });
    });

    await page.getByRole('button', { name: /Cambiar contraseña/i }).click();

    await expect(page.getByText(/error|Error/i)).toBeVisible({ timeout: 10_000 });
  });

  test('loading state disables button while requesting code', async ({ page }) => {
    await goToProfile(page);

    await page.route('**/api/auth/password-reset/request-code/', async (route) => {
      await new Promise((r) => setTimeout(r, 30_000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    const btn = page.getByRole('button', { name: /Cambiar contraseña/i });
    await expect(btn).toBeEnabled({ timeout: 10_000 });
    await btn.click();

    await expect(page.getByRole('button', { name: /Enviando código/i })).toBeDisabled({ timeout: 5_000 });
  });
});
