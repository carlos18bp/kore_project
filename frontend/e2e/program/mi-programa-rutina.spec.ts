import type { Page } from '@playwright/test';
import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeProgramDay = {
  id: 10, date: '2026-05-15', day_number: 15, day_type: 'training',
  exercises: [
    { id: 101, order: 1, sets: 3, reps: 10, duration_seconds: null, rest_seconds: 60,
      exercise: { id: 1, name: 'Sentadilla', pattern: 'squat', youtube_url: null,
        explanation: '', is_corrective: false, primary_muscles: 'Cuádriceps', secondary_muscles: '' } },
    { id: 102, order: 2, sets: 3, reps: 12, duration_seconds: null, rest_seconds: 45,
      exercise: { id: 2, name: 'Press de banca', pattern: 'push', youtube_url: null,
        explanation: '', is_corrective: false, primary_muscles: 'Pectoral', secondary_muscles: '' } },
  ],
};

const fakeDailyLog = {
  id: 55, date: '2026-05-15', is_closed: false, closed_at: null,
  exercise_logs: [
    { id: 201, program_exercise: fakeProgramDay.exercises[0], status: 'not_done', notes: '' },
    { id: 202, program_exercise: fakeProgramDay.exercises[1], status: 'not_done', notes: '' },
  ],
};

async function setupRutinaMocks(page: Page) {
  await page.route('**/api/my-program/today/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ program_day: fakeProgramDay, daily_log: fakeDailyLog }),
    });
  });
  await page.route('**/api/my-program/logs/55/exercises/**', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 201, status: body.status ?? 'completed', notes: '' }),
    });
  });
}

test.describe('Mi Programa — Rutina del Día', { tag: [...FlowTags.CUSTOMER_MI_PROGRAMA_RUTINA, RoleTags.USER] }, () => {
  test('shows exercise name in intro phase', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupRutinaMocks(page);
    await page.goto('/mi-programa/rutina');

    await expect(page.getByRole('heading', { name: 'Sentadilla' })).toBeVisible({ timeout: 15_000 });
  });

  test('intro phase shows sets and reps metadata', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista del cliente; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupRutinaMocks(page);
    await page.goto('/mi-programa/rutina');

    await expect(page.getByText('Series', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Reps', { exact: true })).toBeVisible();
  });

  test('Entendido button transitions to countdown phase', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupRutinaMocks(page);
    await page.goto('/mi-programa/rutina');

    await expect(page.getByRole('button', { name: /Entendido/ })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Entendido/ }).click();

    await expect(page.getByText('Prepárate')).toBeVisible({ timeout: 10_000 });
  });

  test('Omitir ejercicio skips to next exercise', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupRutinaMocks(page);
    await page.goto('/mi-programa/rutina');

    await expect(page.getByRole('button', { name: 'Omitir ejercicio' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Omitir ejercicio' }).click();

    await expect(page.getByRole('heading', { name: 'Press de banca' })).toBeVisible({ timeout: 10_000 });
  });

  test('close button navigates back to /mi-programa', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupRutinaMocks(page);
    await page.goto('/mi-programa');
    await page.route('**/api/my-program/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 1, fitness_level: 1, goal: 'general_health', start_date: '2026-05-01', end_date: '2026-05-28', trainer_notes: '', days: [fakeProgramDay], booking_dates: [], status: 'published', customer_id: 999, approved_at: null, created_at: '' }),
      });
    });
    await page.goto('/mi-programa/rutina');
    await expect(page.getByRole('button', { name: 'Cerrar rutina' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Cerrar rutina' }).click();
    await page.waitForURL('**/mi-programa', { timeout: 10_000 });
  });

  test('shows empty state when no exercises today', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/my-program/today/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          program_day: { ...fakeProgramDay, day_type: 'rest', exercises: [] },
          daily_log: null,
        }),
      });
    });
    await page.goto('/mi-programa/rutina');

    await expect(page.getByText('No hay ejercicios para hoy')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Rutina — validación por cámara', { tag: [...FlowTags.PROGRAM_WORKOUT_CAPTURES, RoleTags.USER] }, () => {
  const CREDIT_VALUES = {
    action_values: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 },
    streak_bonuses: { '3': 20, '7': 50 },
    water_goal_glasses: 8, meal_review_days: 3, require_workout_captures: true,
  };

  async function setupCameraMocks(page: Page) {
    await setupRutinaMocks(page);
    await page.route('**/api/credits/values/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CREDIT_VALUES) });
    });
  }

  test('consent gate: grant closes the gate and shows the workout credit chip', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupCameraMocks(page);
    await page.addInitScript(() => {
      localStorage.removeItem('kore_workout_camera');
      const fakeTrack = { stop: () => undefined, kind: 'video' };
      // @ts-expect-error test stub
      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [fakeTrack],
        getVideoTracks: () => [fakeTrack],
      });
    });
    await page.goto('/mi-programa/rutina');

    await expect(page.getByText('Validación de tu rutina')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/se tomará un video/)).toBeVisible();
    await page.getByRole('button', { name: 'Activar cámara' }).click();
    await expect(page.getByText('Validación de tu rutina')).not.toBeVisible();
    // Intro phase shows the dynamic workout credit chip
    await expect(page.getByText('+15 al validar tu entrenador')).toBeVisible({ timeout: 10_000 });
  });

  test('consent gate: deny keeps the routine usable without validation', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupCameraMocks(page);
    await page.addInitScript(() => localStorage.removeItem('kore_workout_camera'));
    await page.goto('/mi-programa/rutina');

    await expect(page.getByText('Validación de tu rutina')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Entrenar sin validar' }).click();
    await expect(page.getByText('Validación de tu rutina')).not.toBeVisible();
    // Routine still works: intro renders the first exercise
    await expect(page.getByRole('heading', { name: 'Sentadilla' })).toBeVisible({ timeout: 10_000 });
    const stored = await page.evaluate(() => localStorage.getItem('kore_workout_camera'));
    expect(stored).toBe('denied');
  });
});
