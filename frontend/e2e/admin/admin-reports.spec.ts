import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-reports
 * Admin Reports: KPI tiles (revenue/subscriptions/credits/quality) with a
 * preset window selector that refetches on change.
 */

const REPORT = {
  window: '30d',
  revenue: {
    total_cop: 120000,
    subscriptions_cop: 100000,
    credits_cop: 20000,
    trend: [{ month: '2026-07', cop: 120000 }],
  },
  subscriptions: { active: 2, expired: 1, canceled: 0, with_nutrition: 1, with_nutrition_pct: 50 },
  credits: { earned: 30, spent: 10, redemptions_by_status: { pending: 1, fulfilled: 0, rejected: 0 } },
  quality: { average_score: 4.5, rated_count: 4, distribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 2 } },
};

test.describe('Admin Reports', { tag: [...FlowTags.ADMIN_REPORTS, RoleTags.ADMIN] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
  });

  test('renders the KPI blocks and refetches on window change', async ({ page }) => {
    const windows: string[] = [];
    await page.route('**/api/admin/reports/**', async (route) => {
      const url = new URL(route.request().url());
      windows.push(url.searchParams.get('window') ?? '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...REPORT, window: url.searchParams.get('window') ?? '30d' }),
      });
    });

    await page.goto('/admin-platform/reports');

    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ingresos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Calidad' })).toBeVisible();

    await page.getByRole('button', { name: '90 días' }).click();
    await expect.poll(() => windows).toContain('90d');
  });

  test('switching the window renders the refreshed revenue total', async ({ page }) => {
    await page.route('**/api/admin/reports/**', async (route) => {
      const url = new URL(route.request().url());
      const win = url.searchParams.get('window') ?? '30d';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...REPORT,
          window: win,
          revenue: { ...REPORT.revenue, total_cop: win === '90d' ? 450000 : 120000 },
        }),
      });
    });

    await page.goto('/admin-platform/reports');
    await expect(page.getByText('120.000 COP')).toBeVisible();

    await page.getByRole('button', { name: '90 días' }).click();

    await expect(page.getByText('450.000 COP')).toBeVisible();
    await expect(page.getByText('120.000 COP')).toHaveCount(0);
  });

  test('a KPI load failure shows the reports error message', async ({ page }) => {
    await mockApiError(page, '**/api/admin/reports/**', 500, {});

    await page.goto('/admin-platform/reports');

    await expect(page.getByText('No se pudieron cargar los reportes.')).toBeVisible();
    // The window selector stays usable for a retry.
    await expect(page.getByRole('button', { name: '90 días' })).toBeEnabled();
  });
});
