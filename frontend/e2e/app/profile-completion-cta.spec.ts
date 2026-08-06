import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Profile Completion CTA', { tag: [...FlowTags.PROFILE_COMPLETION_CTA, RoleTags.USER] }, () => {

  const incompleteProfileResponse = {
    user: {
      id: 999,
      email: 'e2e@kore.com',
      first_name: '',
      last_name: '',
      phone: '',
      role: 'customer',
      profile_completed: false,
      avatar_url: null,
      customer_profile: {
        profile_completed: false,
        sex: null,
        date_of_birth: null,
        city: null,
        primary_goal: null,
        address: null,
        id_type: null,
        id_number: null,
        id_expedition_date: null,
        avatar_url: null,
        kore_start_date: null,
      },
      today_mood: null,
    },
  };

  async function setupWithIncompleteProfile(page: import('@playwright/test').Page) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    // Override profile AFTER setupDefaultApiMocks (LIFO — last-registered handler has priority)
    await page.route('**/api/auth/profile/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(incompleteProfileResponse),
      });
    });
  }

  test('CTA appears on dashboard when profile is incomplete', async ({ page }) => {
    await setupWithIncompleteProfile(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Queremos conocerte mejor' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Completar mi perfil/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ahora no/i })).toBeVisible();
  });

  test('CTA lists the missing profile fields', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await setupWithIncompleteProfile(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Queremos conocerte mejor' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Nombre')).toBeVisible();
    await expect(page.getByText('Apellido')).toBeVisible();
    await expect(page.getByText('Sexo')).toBeVisible();
    await expect(page.getByText('Objetivo principal')).toBeVisible();
  });

  test('clicking Completar mi perfil navigates to /profile', async ({ page }) => {
    await setupWithIncompleteProfile(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /Completar mi perfil/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Completar mi perfil/i }).click();
    await page.waitForURL('**/profile', { timeout: 15_000 });
  });

  test('clicking Ahora no dismisses the CTA without navigation', async ({ page }) => {
    await setupWithIncompleteProfile(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Queremos conocerte mejor' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Ahora no/i }).click();
    await expect(page.getByRole('heading', { name: 'Queremos conocerte mejor' })).not.toBeVisible({ timeout: 5_000 });
    // URL stays on /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('CTA does not appear when navigating directly to /profile', async ({ page }) => {
    await setupWithIncompleteProfile(page);
    await page.goto('/profile');
    // Give the app time to hydrate and potentially render the CTA
    await expect(page.getByRole('heading', { level: 1, name: /Mi perfil/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Queremos conocerte mejor' })).not.toBeVisible();
  });

  test('CTA does not appear when profile is already complete', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    // setupDefaultApiMocks includes mockAuthProfile which returns profile_completed: true
    await page.goto('/dashboard');
    // Wait for dashboard to load (confirms hydration completed)
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Queremos conocerte mejor' })).not.toBeVisible();
  });
});
