import type { Page } from '@playwright/test';
import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeProgram = {
  id: 1,
  fitness_level: 2,
  goal: 'fat_loss',
  start_date: '2026-05-01',
  end_date: '2026-05-28',
  trainer_notes: 'Mantén el ritmo esta semana.',
  days: [
    {
      id: 10, date: '2026-05-15', day_number: 15, day_type: 'training',
      exercises: [
        { id: 101, order: 1, sets: 3, reps: 10, duration_seconds: null, rest_seconds: 60,
          exercise: { id: 1, name: 'Sentadilla', category: 'legs', video_url: null } },
      ],
    },
    { id: 11, date: '2026-05-16', day_number: 16, day_type: 'active_rest', exercises: [] },
    { id: 12, date: '2026-05-17', day_number: 17, day_type: 'rest', exercises: [] },
  ],
};

async function setupProgramMocks(page: Page) {
  await page.route('**/api/my-program/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeProgram),
    });
  });
  await page.route('**/api/my-program/today/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ day: fakeProgram.days[0], log_id: 55, exercise_logs: [] }),
    });
  });
}

test.describe('Mi Programa — Overview', { tag: [...FlowTags.CUSTOMER_MI_PROGRAMA, RoleTags.USER] }, () => {
  test('page loads and shows fitness level heading', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/mi-programa');

    await expect(page.getByRole('heading', { name: 'Básico' })).toBeVisible({ timeout: 15_000 });
  });

  test('hero card shows program label and entrenos stat', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/mi-programa');

    // "Mi Programa" appears in the hero dark card as a label
    await expect(page.getByText('Mi Programa').first()).toBeVisible({ timeout: 10_000 });
    // "entrenos" appears as a lowercase stat label in the hero card
    await expect(page.getByText('entrenos').first()).toBeVisible();
  });

  test('stats strip shows Recuperación and Descanso labels', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/mi-programa');

    // Stats grid labels (stats strip section)
    await expect(page.getByText('Recuperación').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Descanso').first()).toBeVisible();
  });

  test('fitness level badge renders level name', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/mi-programa');

    await expect(page.getByText('Básico').first()).toBeVisible({ timeout: 10_000 });
  });

  test('today CTA card has link to /mi-programa/rutina', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/mi-programa');

    const rutinaLink = page.getByRole('link', { name: /Iniciar rutina|Día de entrenamiento/i }).first();
    await expect(rutinaLink).toBeVisible({ timeout: 10_000 });
    const href = await rutinaLink.getAttribute('href');
    expect(href).toContain('/mi-programa/rutina');
  });

  test('shows empty state when no active program', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/my-program/', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
    });
    await page.route('**/api/my-program/today/', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
    });
    await page.goto('/mi-programa');

    await expect(page.getByText('Sin programa activo')).toBeVisible({ timeout: 15_000 });
  });
});
