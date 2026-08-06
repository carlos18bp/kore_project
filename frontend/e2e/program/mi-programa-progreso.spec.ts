import type { Page } from '@playwright/test';
import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeWeeklySummary = {
  week_number: 2,
  week_average: 0.78,
  days: [
    { date: '2026-05-11', training_adherence: 1.0, nutrition_adherence: 0.8, combined_adherence: 0.92 },
    { date: '2026-05-12', training_adherence: 0.0, nutrition_adherence: 0.6, combined_adherence: 0.24 },
    { date: '2026-05-13', training_adherence: 1.0, nutrition_adherence: 0.9, combined_adherence: 0.96 },
  ],
  streak: { current: 2, longest: 5 },
};

async function setupProgresoMocks(page: Page, summary = fakeWeeklySummary) {
  await page.route('**/api/my-program/weekly-summary/**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(summary),
    });
  });
}

test.describe('Mi Programa — Progreso', { tag: [...FlowTags.CUSTOMER_MI_PROGRAMA_PROGRESO, RoleTags.USER] }, () => {
  test('page loads and shows Mi Progreso heading', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgresoMocks(page);
    await page.goto('/mi-programa/progreso');

    await expect(page.getByRole('heading', { name: 'Mi Progreso' })).toBeVisible({ timeout: 15_000 });
  });

  test('shows weekly adherence percentage', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgresoMocks(page);
    await page.goto('/mi-programa/progreso');

    await expect(page.getByText('78%')).toBeVisible({ timeout: 10_000 });
  });

  test('week selector buttons are visible (Sem. 1–4)', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgresoMocks(page);
    await page.goto('/mi-programa/progreso');

    await expect(page.getByRole('button', { name: 'Sem. 1' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Sem. 2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sem. 3' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sem. 4' })).toBeVisible();
  });

  test('Racha section renders streak data', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await setupProgresoMocks(page);
    await page.goto('/mi-programa/progreso');

    await expect(page.getByText('Racha', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('empty state shown when no weekly data', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    await page.route('**/api/my-program/weekly-summary/**', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
    });
    await page.goto('/mi-programa/progreso');

    await expect(page.getByText('No hay datos de progreso todavía.')).toBeVisible({ timeout: 15_000 });
  });
});
