import { test, expect, E2E_USER, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Profile page (/profile).
 * Covers viewing/editing personal info, avatar, goal selection, mood display, and summary card.
 *
 * Strategy: inject auth cookies + default API mocks, override /auth/profile/ with rich
 * profile data (LIFO priority), then navigate directly to /profile.
 */
test.describe('Profile Page', { tag: [...FlowTags.PROFILE_MANAGEMENT, RoleTags.USER] }, () => {

  const richProfile = {
    user: {
      id: 999,
      email: E2E_USER.email,
      first_name: E2E_USER.firstName,
      last_name: E2E_USER.lastName,
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

  /**
   * Setup auth + default mocks, override /auth/profile/ with custom payload (LIFO),
   * and navigate directly to /profile.
   */
  async function goToProfileWith(page: import('@playwright/test').Page, payload = richProfile) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/auth/profile/', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { ...payload.user, ...JSON.parse(route.request().postData() || '{}') } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payload),
        });
      }
    });
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible({ timeout: 15_000 });
  }

  test('renders page heading and subheading', async ({ page }) => {
    await goToProfileWith(page);
    await expect(page.getByText('Tu espacio personal')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible();
  });

  test('renders profile avatar card with user name and email', async ({ page }) => {
    await goToProfileWith(page);
    const main = page.getByRole('main');
    await expect(main.getByText(E2E_USER.fullName)).toBeVisible();
    await expect(main.getByText(E2E_USER.email)).toBeVisible();
    await expect(main.getByText('Miembro desde')).toBeVisible();
  });

  test('renders personal info form with pre-filled values', async ({ page }) => {
    await goToProfileWith(page);
    await expect(page.getByRole('heading', { name: 'Mi información' })).toBeVisible();
    await expect(page.getByText('Nombre', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Apellido', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Teléfono', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Sexo', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Dirección', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Ciudad', { exact: false }).first()).toBeVisible();
  });

  test('renders goal selector with current selection highlighted', async ({ page }) => {
    await goToProfileWith(page);
    await expect(page.getByRole('heading', { name: 'Mi meta principal' })).toBeVisible();
    await expect(page.getByText('Selecciona tu objetivo para personalizar tu experiencia.')).toBeVisible();
    const selectedGoal = page.locator('button').filter({ hasText: 'Perder grasa' });
    await expect(selectedGoal).toBeVisible();
  });

  test('renders mood check-in card with today score', async ({ page }) => {
    await goToProfileWith(page);
    await expect(page.getByRole('heading', { name: 'Tu estado de hoy' })).toBeVisible();
    await expect(page.getByText('de 10')).toBeVisible();
    await expect(page.getByText('Bien', { exact: true })).toBeVisible();
  });

  test('renders mood empty state when no mood set', async ({ page }) => {
    const noMoodPayload = JSON.parse(JSON.stringify(richProfile));
    noMoodPayload.user.today_mood = null;
    await goToProfileWith(page, noMoodPayload);
    await expect(page.getByText('Aún no has registrado tu estado de hoy.')).toBeVisible({ timeout: 15_000 });
  });

  test('renders security card with password change button', async ({ page }) => {
    await goToProfileWith(page);
    await expect(page.getByRole('heading', { name: 'Seguridad' })).toBeVisible();
    await expect(page.getByText('Para cambiar tu contraseña, te enviaremos un código de verificación')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cambiar contraseña' })).toBeVisible();
  });

  test('renders quick stats summary card with profile data', async ({ page }) => {
    await goToProfileWith(page);
    const summaryHeading = page.getByRole('heading', { name: 'Resumen' });
    await expect(summaryHeading).toBeVisible();
    const summaryCard = summaryHeading.locator('..');
    await expect(summaryCard.getByText('Bogotá')).toBeVisible();
    await expect(summaryCard.getByText('Sura')).toBeVisible();
    await expect(summaryCard.getByText('Objetivo')).toBeVisible();
  });

  test('empty profile shows placeholder in summary card', async ({ page }) => {
    const emptyPayload = JSON.parse(JSON.stringify(richProfile));
    emptyPayload.user.customer_profile.city = '';
    emptyPayload.user.customer_profile.date_of_birth = '';
    emptyPayload.user.customer_profile.primary_goal = '';
    emptyPayload.user.customer_profile.eps = '';
    await goToProfileWith(page, emptyPayload);
    await expect(page.getByText('Completa tu perfil para ver tu resumen')).toBeVisible();
  });

  test('field edit triggers debounced save with toast feedback', async ({ page }) => {
    await goToProfileWith(page);
    const cityInput = page.locator('input[placeholder="Tu ciudad"]');
    await cityInput.fill('Medellín');
    await expect(page.getByText('Guardando...')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Guardado')).toBeVisible({ timeout: 10_000 });
  });
});
