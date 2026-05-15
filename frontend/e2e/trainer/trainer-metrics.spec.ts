import type { Page } from '@playwright/test';
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeComparativeMetrics = {
  global_patterns: {
    avg_training_adherence: 0.72,
    avg_nutrition_adherence: 0.65,
    most_missed_day_of_week: 'saturday',
  },
  adherence_ranking: [
    { customer_id: 10, name: 'María López', combined_7d: 0.91, delta_vs_last_week: 0.05 },
    { customer_id: 11, name: 'Carlos García', combined_7d: 0.74, delta_vs_last_week: -0.08 },
  ],
  improved_this_week: [
    { customer_id: 10, name: 'María López', delta: 0.05 },
  ],
  worsened_this_week: [
    { customer_id: 11, name: 'Carlos García', delta: -0.08 },
  ],
  most_failed_exercises: [
    { name: 'Dominadas', count: 5 },
  ],
  most_failed_meal_blocks: [
    { block: 'cena', block_label: 'Cena', count: 8 },
  ],
  expired_evaluations: [
    { customer_id: 12, name: 'Ana Torres', module: 'anthropometry', module_label: 'Antropometría', days_since: 45, urgency: 'critical' },
  ],
};

async function setupMetricsMocks(page: Page, metrics = fakeComparativeMetrics) {
  await page.route('**/api/trainer/comparative-metrics/', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(metrics),
    });
  });
  await page.route('**/api/trainer/dashboard-stats/', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total_clients: 3, today_sessions: 1, upcoming_sessions: [] }),
    });
  });
}

test.describe('Trainer Metrics', { tag: [...FlowTags.TRAINER_METRICS, RoleTags.TRAINER] }, () => {
  test('page loads with Métricas Comparativas heading', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMetricsMocks(page);
    await page.goto('/trainer/metrics');

    await expect(page.getByRole('heading', { name: 'Métricas Comparativas' })).toBeVisible({ timeout: 15_000 });
  });

  test('adherence rings show Entreno and Nutrición labels', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMetricsMocks(page);
    await page.goto('/trainer/metrics');

    await expect(page.getByText('Entreno')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Nutrición')).toBeVisible();
  });

  test('adherence ranking section renders client names', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMetricsMocks(page);
    await page.goto('/trainer/metrics');

    await expect(page.getByText('Ranking de adherencia')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('María López')).toBeVisible();
    await expect(page.getByText('Carlos García')).toBeVisible();
  });

  test('failed patterns section renders exercise names', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMetricsMocks(page);
    await page.goto('/trainer/metrics');

    await expect(page.getByText('Ejercicios más saltados')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Dominadas')).toBeVisible();
  });

  test('expired evaluations section renders', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMetricsMocks(page);
    await page.goto('/trainer/metrics');

    await expect(page.getByText('Evaluaciones vencidas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Ana Torres')).toBeVisible();
  });
});
