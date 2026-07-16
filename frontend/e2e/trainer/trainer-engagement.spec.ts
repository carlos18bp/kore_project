import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:trainer-engagement
 * The trainer reads Fase 2 engagement over their portfolio at /trainer/metrics:
 * summary tiles + a per-client roster.
 */

const ENGAGEMENT = {
  summary: {
    clients_total: 2, active_streaks: 1, checked_in_today: 1, checked_in_today_pct: 50,
    credits_earned_30d: 30, credits_spent_30d: 10, attendance_rate_30d: 50,
  },
  roster: [
    { customer_id: 1, name: 'Ana García', current_streak: 7, last_checkin: '2026-07-15', attendance_rate_30d: 100, average_rating: 5 },
  ],
};

const RATINGS = { average: 4.5, count: 4, recent: [] };

test.describe('Trainer — engagement', { tag: [...FlowTags.TRAINER_ENGAGEMENT, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await injectTrainerAuthCookies(page);
  });

  test('shows portfolio summary and roster', async ({ page }) => {
    await page.route('**/api/trainer/engagement/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ENGAGEMENT) }),
    );
    await page.route('**/api/trainer/ratings/summary/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RATINGS) }),
    );

    await page.goto('/trainer/metrics');

    await expect(page.getByRole('heading', { name: 'Engagement de tu cartera' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Rachas activas')).toBeVisible();
    await expect(page.getByText('Ana García')).toBeVisible();
  });
});
