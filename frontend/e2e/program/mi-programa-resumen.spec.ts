import type { Page } from '@playwright/test';
import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeMonthlySummary = {
  start_date: '2026-05-01',
  end_date: '2026-05-28',
  overall_adherence: 0.76,
  training_adherence: 0.82,
  nutrition_adherence: 0.67,
  comparisons: {
    bmi:            { before: 25.4, after: 24.9, delta: -0.02 },
    body_fat_pct:   { before: 22.1, after: 21.3, delta: -0.036 },
    physical_index: { before: 68.0, after: 71.5, delta: 0.051 },
  },
  weight: { start: 78.5, end: 77.2, delta: -0.017 },
  mood: { first_week: 6, last_week: 8 },
  streak_best: 7,
};

async function setupResumenMocks(page: Page, summary = fakeMonthlySummary) {
  await page.route('**/api/my-program/monthly-summary/**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(summary),
    });
  });
}

test.describe('Mi Programa — Resumen Mensual', { tag: [...FlowTags.CUSTOMER_MI_PROGRAMA_RESUMEN, RoleTags.USER] }, () => {
  test('page loads and shows Resumen Mensual heading', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupResumenMocks(page);
    await page.goto('/mi-programa/resumen');

    await expect(page.getByRole('heading', { name: 'Resumen Mensual' })).toBeVisible({ timeout: 15_000 });
  });

  test('shows overall adherence percentage', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupResumenMocks(page);
    await page.goto('/mi-programa/resumen');

    await expect(page.getByText('76%')).toBeVisible({ timeout: 10_000 });
  });

  test('Evolución section with comparison labels is visible', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupResumenMocks(page);
    await page.goto('/mi-programa/resumen');

    await expect(page.getByText('Evolución')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Índice de masa corporal (IMC)')).toBeVisible();
  });

  test('mood section shows first and last week scores', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupResumenMocks(page);
    await page.goto('/mi-programa/resumen');

    await expect(page.getByText('Bienestar')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('1ª semana')).toBeVisible();
    await expect(page.getByText('Última semana')).toBeVisible();
  });

  test('empty state when no monthly data', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/my-program/monthly-summary/**', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
    });
    await page.goto('/mi-programa/resumen');

    await expect(page.getByText('No hay datos de resumen todavía.')).toBeVisible({ timeout: 15_000 });
  });
});
