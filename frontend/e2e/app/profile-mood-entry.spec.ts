import { test, expect, E2E_USER, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the MoodCheckIn modal that auto-opens on /profile when no
 * mood entry has been logged today. Covers score selection, submission,
 * dismiss, and the "already logged" path.
 *
 * NOTE: The /profile page also has a static "mood card" with the same heading
 * "¿Cómo te sientes hoy?" when no mood is set. To distinguish the modal from
 * the static card, the assertions key off the "Registrar" button which only
 * exists inside the modal overlay.
 *
 * Weight tracking has a backend endpoint and store action but no UI surface,
 * so it is intentionally not exercised here.
 */
test.describe('Profile Mood Entry', { tag: [...FlowTags.PROFILE_MOOD_ENTRY, RoleTags.USER] }, () => {

  function buildProfile(overrides: { today_mood?: object | null } = {}) {
    return {
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
          date_of_birth: '1990-05-15',
          city: 'Bogotá',
          primary_goal: 'fat_loss',
        },
        today_mood: overrides.today_mood !== undefined ? overrides.today_mood : null,
      },
    };
  }

  async function setupProfileMocks(page: import('@playwright/test').Page, options: { hasTodayMood?: boolean; submitOk?: boolean } = {}) {
    const { hasTodayMood = false, submitOk = true } = options;
    const todayMood = hasTodayMood
      ? { score: 6, notes: '', date: new Date().toISOString().slice(0, 10) }
      : null;

    await page.route('**/api/auth/profile/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildProfile({ today_mood: todayMood })),
      });
    });

    await page.route('**/api/auth/mood/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: submitOk ? 201 : 500,
          contentType: 'application/json',
          body: JSON.stringify(
            submitOk
              ? { score: 9, notes: 'Excelente día', date: new Date().toISOString().slice(0, 10) }
              : { detail: 'Server error' }
          ),
        });
      } else {
        await route.continue();
      }
    });
  }

  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
  });

  test('MoodCheckIn modal opens automatically on profile page when no mood today', async ({ page }) => {
    await setupProfileMocks(page);

    await page.goto('/profile');
    // The Registrar button is unique to the modal overlay (not present on the static profile card)
    await expect(page.getByRole('button', { name: 'Registrar' })).toBeVisible({ timeout: 15_000 });
  });

  test('renders all 10 score buttons, Registrar and Ahora no buttons', async ({ page }) => {
    await setupProfileMocks(page);

    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Registrar' })).toBeVisible({ timeout: 15_000 });

    for (let n = 1; n <= 10; n += 1) {
      await expect(page.getByRole('button', { name: String(n), exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Ahora no' })).toBeVisible();
  });

  test('selecting score 9 and submitting calls POST /auth/mood/', async ({ page }) => {
    await setupProfileMocks(page);

    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Registrar' })).toBeVisible({ timeout: 15_000 });

    // Select score 9 and add notes
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByPlaceholder('Notas adicionales (opcional)').fill('Excelente día de entrenamiento');

    // Wait for the POST and click submit
    const moodPost = page.waitForResponse(
      (response) => response.url().includes('/api/auth/mood/') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Registrar' }).click();
    const response = await moodPost;
    expect(response.ok()).toBe(true);

    // Confirmation card appears (showConfirmation state)
    await expect(page.getByText('Registrado. ¡Gracias!')).toBeVisible({ timeout: 5_000 });
  });

  test('does NOT open modal when today_mood already exists', async ({ page }) => {
    await setupProfileMocks(page, { hasTodayMood: true });

    await page.goto('/profile');
    // Profile page renders
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible({ timeout: 15_000 });
    // The modal-only Registrar button is NOT present
    await expect(page.getByRole('button', { name: 'Registrar' })).not.toBeVisible();
  });

  test('Ahora no dismiss closes modal and persists in sessionStorage', async ({ page }) => {
    await setupProfileMocks(page);

    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Registrar' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Ahora no' }).click();

    // Modal-only Registrar button disappears after dismiss
    await expect(page.getByRole('button', { name: 'Registrar' })).not.toBeVisible();

    const dismissed = await page.evaluate(() => sessionStorage.getItem('kore_mood_dismissed'));
    expect(dismissed).toBe('1');
  });
});
