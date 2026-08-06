import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeProgramDay = {
  id: 10, date: '2026-05-15', day_number: 15, day_type: 'training',
  exercises: [
    { id: 101, order: 1, sets: 3, reps: 10, duration_seconds: null, rest_seconds: 60,
      exercise: { id: 1, name: 'Sentadilla', pattern: 'squat', youtube_url: null,
        explanation: '', is_corrective: false, primary_muscles: 'Cuádriceps', secondary_muscles: '' } },
  ],
};

const fakeDailyLog = {
  id: 55, date: '2026-05-15', is_closed: false, closed_at: null,
  exercise_logs: [
    { id: 201, program_exercise: fakeProgramDay.exercises[0], status: 'not_done', notes: '' },
  ],
};

test.describe('Mi Programa — Día Específico', { tag: [...FlowTags.CUSTOMER_MI_PROGRAMA_DIA, RoleTags.USER] }, () => {
  test('visiting today date redirects to /mi-programa/rutina', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/my-program/today/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ program_day: fakeProgramDay, daily_log: fakeDailyLog }),
      });
    });

    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/mi-programa/dia/detail?date=${today}`);

    await page.waitForURL('**/mi-programa/rutina', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/mi-programa\/rutina/);
  });

  test('visiting a past date redirects to /mi-programa', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/my-program/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 1, fitness_level: 1, goal: 'general_health', start_date: '2026-05-01', end_date: '2026-05-28', trainer_notes: '', days: [fakeProgramDay], booking_dates: [], status: 'published', customer_id: 999, approved_at: null, created_at: '' }),
      });
    });
    await page.route('**/api/my-program/today/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ program_day: fakeProgramDay, daily_log: fakeDailyLog }),
      });
    });

    await page.goto('/mi-programa/dia/detail?date=2026-05-10');

    await page.waitForURL('**/mi-programa', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/mi-programa$/);
  });

  test('day detail route is accessible without error', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/my-program/**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json', body: 'null',
      });
    });

    const response = await page.goto('/mi-programa/dia/detail?date=2026-05-10');
    expect(response?.status()).not.toBe(404);
    await expect(page).toHaveURL(/\/mi-programa$/, { timeout: 15_000 });
  });

  test('the detail page renders its loading spinner then redirects to the routine', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);

    const today = new Date().toISOString().slice(0, 10);
    // 'commit' returns as soon as the document loads, so we can observe the
    // spinner DiaDetailPage renders before its redirect effect runs. That
    // redirect is a pure client-side effect (awaits no API), so asserting a
    // mid-flight detail URL is racy — assert the spinner render and the
    // deterministic destination instead.
    await page.goto(`/mi-programa/dia/detail?date=${today}`, { waitUntil: 'commit' });

    // quality: allow-fragile-selector (the loading spinner is a decorative div with no role or text to target)
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 10_000 });
    await page.waitForURL('**/mi-programa/rutina', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/mi-programa\/rutina/);
  });
});
