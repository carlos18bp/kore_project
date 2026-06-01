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

// Métricas quedó parqueada para la Fase 3: /trainer/metrics renderiza el
// placeholder "Próximamente" (ver page.tsx, flag PHASE_3_READY). Estos tests
// verifican ese placeholder. Cuando la Fase 3 reactive la vista, restaurar la
// suite completa desde el historial de git.
test.describe('Trainer Metrics', { tag: [...FlowTags.TRAINER_METRICS, RoleTags.TRAINER] }, () => {
  test('renders the Próximamente placeholder for the Métricas section', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMetricsMocks(page);
    await page.goto('/trainer/metrics');

    await expect(page.getByRole('heading', { name: 'Próximamente' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('main').getByText('Métricas', { exact: true })).toBeVisible();
  });

  test('placeholder states the section ships in Fase 3', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMetricsMocks(page);
    await page.goto('/trainer/metrics');

    await expect(page.getByText(/Esta sección está en construcción/)).toBeVisible({ timeout: 15_000 });
  });
});
