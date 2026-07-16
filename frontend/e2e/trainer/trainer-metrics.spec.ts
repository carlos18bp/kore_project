import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * /trainer/metrics no longer shows the Fase 3 "Próximamente" placeholder: with
 * PHASE_3_READY still false, the route now serves the Parte 11b engagement view
 * (see trainer-engagement.spec.ts for the full flow). The Fase 3 "Métricas
 * Comparativas" suite is preserved in git history and returns when PHASE_3_READY
 * flips true. These tests guard that the placeholder is gone and the engagement
 * view is what a trainer lands on.
 */

const ENGAGEMENT = {
  summary: {
    clients_total: 1, active_streaks: 1, checked_in_today: 1, checked_in_today_pct: 100,
    credits_earned_30d: 20, credits_spent_30d: 0, attendance_rate_30d: null,
  },
  roster: [
    { customer_id: 1, name: 'María López', current_streak: 3, last_checkin: '2026-07-15', attendance_rate_30d: null, average_rating: null },
  ],
};

test.describe('Trainer Metrics', { tag: [...FlowTags.TRAINER_METRICS, RoleTags.TRAINER] }, () => {
  test.beforeEach(async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await page.route('**/api/trainer/engagement/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ENGAGEMENT) }),
    );
    await page.route('**/api/trainer/ratings/summary/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ average: null, count: 0, recent: [] }) }),
    );
  });

  test('serves the engagement view, not the Fase 3 placeholder', async ({ page }) => {
    await page.goto('/trainer/metrics');
    await expect(page.getByRole('heading', { name: 'Engagement de tu cartera' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Próximamente' })).toHaveCount(0);
  });
});
