import { test, expect, E2E_USER, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the MoodCheckIn modal (4-step check-in: ánimo → energía →
 * dolor → listo para entrenar) that auto-opens when no mood entry has been
 * logged today. Covers the step flow, credit chip, submission payload,
 * dismiss, and the "already logged" path.
 *
 * The modal root carries data-testid="mood-checkin-modal" to distinguish it
 * from the static mood card on /profile.
 */
test.describe('Profile Mood Entry', { tag: [...FlowTags.PROFILE_MOOD_ENTRY, RoleTags.USER] }, () => {

  const CREDIT_VALUES = {
    action_values: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 },
    streak_bonuses: { '3': 20, '7': 50 },
    water_goal_glasses: 8, meal_review_days: 3, require_workout_captures: true,
  };

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

  async function setupProfileMocks(page: import('@playwright/test').Page, options: { hasTodayMood?: boolean } = {}) {
    const { hasTodayMood = false } = options;
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

    await page.route('**/api/credits/values/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CREDIT_VALUES),
      });
    });

    await page.route('**/api/auth/mood/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            score: 8, notes: '', date: new Date().toISOString().slice(0, 10),
            energy_level: 4, pain: false, ready_to_train: true,
          }),
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

  test('modal auto-opens with the credit chip when no mood today', async ({ page }) => {
    await setupProfileMocks(page);

    await page.goto('/profile');
    const modal = page.getByTestId('mood-checkin-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText(/Check-in de hoy · \+5 créditos/)).toBeVisible();
    await expect(modal.getByText('¿Cómo te sientes hoy?')).toBeVisible();
  });

  test('renders the 10 score buttons on the first step', async ({ page }) => {
    await setupProfileMocks(page);

    await page.goto('/profile');
    const modal = page.getByTestId('mood-checkin-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });

    for (let n = 1; n <= 10; n += 1) {
      await expect(modal.getByRole('button', { name: String(n), exact: true })).toBeVisible();
    }
    await expect(modal.getByRole('button', { name: 'Ahora no' })).toBeVisible();
  });

  test('completes the 4-step check-in and posts extras', async ({ page }) => {
    await setupProfileMocks(page);
    let moodPayload: Record<string, unknown> | null = null;
    await page.route('**/api/auth/mood/', async (route) => {
      if (route.request().method() === 'POST') {
        moodPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ score: 8, notes: '', date: '2026-07-15', energy_level: 4, pain: false, ready_to_train: true }),
        });
      }
      return route.continue();
    });

    await page.goto('/profile');
    const modal = page.getByTestId('mood-checkin-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });

    await modal.getByRole('button', { name: '8', exact: true }).click();
    await expect(modal.getByText('¿Cuánta energía tienes?')).toBeVisible();
    await modal.getByRole('button', { name: /Bien/ }).click();
    await expect(modal.getByText('¿Tienes algún dolor o molestia?')).toBeVisible();
    await modal.getByRole('button', { name: 'Sin dolor' }).click();
    await expect(modal.getByText('¿Listo para entrenar hoy?')).toBeVisible();
    await modal.getByRole('button', { name: '¡Listo para entrenar!' }).click();

    await expect(page.getByText('Registrado. ¡Gracias!')).toBeVisible({ timeout: 5_000 });
    expect(moodPayload).toMatchObject({ score: 8, energy_level: 4, pain: false, ready_to_train: true });
  });

  test('does NOT open modal when today_mood already exists', async ({ page }) => {
    await setupProfileMocks(page, { hasTodayMood: true });

    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('mood-checkin-modal')).not.toBeVisible();
  });

  test('Ahora no dismiss closes modal and persists in sessionStorage', async ({ page }) => {
    await setupProfileMocks(page);

    await page.goto('/profile');
    const modal = page.getByTestId('mood-checkin-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });

    await modal.getByRole('button', { name: 'Ahora no' }).click();
    await expect(modal).not.toBeVisible();

    const dismissed = await page.evaluate(() => sessionStorage.getItem('kore_mood_dismissed'));
    expect(dismissed).toBe('1');
  });
});
