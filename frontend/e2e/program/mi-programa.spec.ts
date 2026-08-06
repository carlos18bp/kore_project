import type { Page } from '@playwright/test';
import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const fakeProgram = {
  id: 1,
  fitness_level: 2,
  goal: 'fat_loss',
  start_date: isoDate(0),
  end_date: isoDate(27),
  trainer_notes: 'Mantén el ritmo esta semana.',
  days: [
    {
      id: 10, date: isoDate(0), day_number: 1, day_type: 'training',
      exercises: [
        { id: 101, order: 1, sets: 3, reps: 10, duration_seconds: null, rest_seconds: 60,
          exercise: { id: 1, name: 'Sentadilla', category: 'legs', video_url: null } },
      ],
    },
    { id: 11, date: isoDate(1), day_number: 2, day_type: 'active_rest', exercises: [] },
    { id: 12, date: isoDate(2), day_number: 3, day_type: 'rest', exercises: [] },
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
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('kore_splash_shown', '1'));
    await page.goto('/mi-programa');

    await expect(page.getByRole('heading', { name: 'Básico' })).toBeVisible({ timeout: 15_000 });
  });

  test('hero card shows program label and entrenos stat', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista del cliente; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('kore_splash_shown', '1'));
    await page.goto('/mi-programa');

    // "Mi Programa" appears in the hero dark card as a label
    await expect(page.getByText('Mi Programa').first()).toBeVisible({ timeout: 10_000 });
    // "entrenos" appears as a lowercase stat label in the hero card
    await expect(page.getByText('entrenos').first()).toBeVisible({ timeout: 10_000 });
  });

  test('stats strip shows Recuperación and Descanso labels', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('kore_splash_shown', '1'));
    await page.goto('/mi-programa');

    // Stats grid labels (stats strip section)
    await expect(page.getByText('Recuperación').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Descanso').first()).toBeVisible();
  });

  test('fitness level badge renders level name', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('kore_splash_shown', '1'));
    await page.goto('/mi-programa');

    await expect(page.getByText('Básico').first()).toBeVisible({ timeout: 10_000 });
  });

  test('today CTA card has link to /mi-programa/rutina', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgramMocks(page);
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('kore_splash_shown', '1'));
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
    await page.goto('/');
    await page.evaluate(() => sessionStorage.setItem('kore_splash_shown', '1'));
    await page.goto('/mi-programa');

    await expect(page.getByText('Sin programa activo')).toBeVisible({ timeout: 15_000 });
  });
});
