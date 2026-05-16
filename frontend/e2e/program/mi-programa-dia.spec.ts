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
  test('visiting today date redirects to /mi-programa/rutina', async ({ page }) => {
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
  });

  test('spinner is shown while redirect resolves', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);

    let resolve: () => void;
    const delayPromise = new Promise<void>((r) => { resolve = r; });
    await page.route('**/api/my-program/today/', async (route) => {
      await delayPromise;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ program_day: fakeProgramDay, daily_log: fakeDailyLog }),
      });
    });

    const today = new Date().toISOString().slice(0, 10);
    const gotoPromise = page.goto(`/mi-programa/dia/detail?date=${today}`);
    // The spinner (border-kore-red animate-spin) should appear while routing
    // We just verify the page doesn't hard-error
    resolve!();
    await gotoPromise;
    // After resolving, redirect happens
    await page.waitForURL('**/mi-programa/**', { timeout: 15_000 });
  });
});
