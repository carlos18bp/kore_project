import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const GRANTS = [{ id: 1, sessions_total: 3, sessions_used: 1, sessions_remaining: 2, expires_at: '2026-08-05T00:00:00Z' }];

test.describe('Sesiones adicionales', { tag: [...FlowTags.CUSTOMER_SESSION_GRANTS, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/credits/wallet/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balance: 55, pending_balance: 0, current_streak: 1, longest_streak: 1, last_active_date: '2026-07-06', next_milestone: null }) }));
    await page.route('**/api/credits/transactions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
    await page.route('**/api/store/redemptions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/session-grants/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GRANTS) }));
  });

  test('shows active grants in mis-creditos', async ({ page }) => {
    await page.goto('/mis-creditos');
    await expect(page.getByText('Sesiones adicionales', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('2 sesiones')).toBeVisible();
  });
});
