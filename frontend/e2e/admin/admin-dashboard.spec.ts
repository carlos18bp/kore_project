import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-dashboard
 * Admin overview: the four subscription stat tiles (total/active/expired/canceled)
 * and the management shortcut cards.
 */

type AdminSubscription = {
  id: number;
  customer_id: number;
  customer_email: string;
  customer_name: string;
  package: {
    id: number;
    title: string;
    category: 'personalizado' | 'semi_personalizado' | 'terapeutico';
    sessions_count: number;
    session_duration_minutes: number;
    price: string;
    currency: string;
    validity_days: number;
  };
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  status: 'active' | 'expired' | 'canceled';
  starts_at: string;
  expires_at: string;
  is_recurring: boolean;
  next_billing_date: string | null;
  billing_failed_at: string | null;
  is_duo: boolean;
  guest_info: null;
  created_at: string;
  updated_at: string;
};

function makeSub(
  id: number,
  status: AdminSubscription['status'],
  category: AdminSubscription['package']['category'] = 'personalizado',
): AdminSubscription {
  return {
    id,
    customer_id: 500 + id,
    customer_email: `cliente${id}@kore.com`,
    customer_name: `Cliente ${id}`,
    package: {
      id: 1,
      title: 'Plan Kore',
      category,
      sessions_count: 10,
      session_duration_minutes: 60,
      price: '300000',
      currency: 'COP',
      validity_days: 30,
    },
    sessions_total: 10,
    sessions_used: 3,
    sessions_remaining: 7,
    status,
    starts_at: '2026-06-01T10:00:00Z',
    expires_at: '2026-07-01T10:00:00Z',
    is_recurring: false,
    next_billing_date: null,
    billing_failed_at: null,
    is_duo: false,
    guest_info: null,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  };
}

// 3 active, 2 expired, 1 canceled — distinct counts so each tile value is unambiguous.
const SUBSCRIPTIONS: AdminSubscription[] = [
  makeSub(1, 'active'),
  makeSub(2, 'active', 'semi_personalizado'),
  makeSub(3, 'active', 'terapeutico'),
  makeSub(4, 'expired'),
  makeSub(5, 'expired', 'semi_personalizado'),
  makeSub(6, 'canceled'),
];

async function mockSubscriptions(
  page: import('@playwright/test').Page,
  results: AdminSubscription[] = SUBSCRIPTIONS,
) {
  await page.route('**/api/subscriptions/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: results.length, next: null, previous: null, results }),
    });
  });
}

/** The StatTile that carries a given kicker (nearest rounded-2xl ancestor of the kicker text). */
function statTile(page: import('@playwright/test').Page, kicker: string) {
  return page
    .getByText(kicker, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
}

test.describe('Admin Dashboard', { tag: [...FlowTags.ADMIN_DASHBOARD, RoleTags.ADMIN] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
  });

  test('renders the four subscription stat tiles with their labels', async ({ page }) => {
    await mockSubscriptions(page);
    await page.goto('/admin-platform/dashboard');

    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('Activas', { exact: true })).toBeVisible();
    await expect(page.getByText('Expiradas', { exact: true })).toBeVisible();
    await expect(page.getByText('Canceladas', { exact: true })).toBeVisible();
    await expect(page.getByText('suscripciones cargadas')).toBeVisible();
    await expect(page.getByText('con sesiones disponibles')).toBeVisible();
  });

  test('reflects the mocked subscription totals per status', async ({ page }) => {
    await mockSubscriptions(page);
    await page.goto('/admin-platform/dashboard');

    await expect(statTile(page, 'Total')).toContainText('6');
    await expect(statTile(page, 'Activas')).toContainText('3');
    await expect(statTile(page, 'Expiradas')).toContainText('2');
    await expect(statTile(page, 'Canceladas')).toContainText('1');
  });

  test('renders zeros when there are no subscriptions', async ({ page }) => {
    await mockSubscriptions(page, []);
    await page.goto('/admin-platform/dashboard');

    await expect(statTile(page, 'Total')).toContainText('0');
    await expect(statTile(page, 'Activas')).toContainText('0');
    await expect(statTile(page, 'Expiradas')).toContainText('0');
    await expect(statTile(page, 'Canceladas')).toContainText('0');
  });

  test('shows the management shortcut cards', async ({ page }) => {
    await mockSubscriptions(page);
    await page.goto('/admin-platform/dashboard');

    await expect(page.getByText('Gestión de suscripciones')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver todas' })).toBeVisible();
    await expect(page.getByText('Gestión de usuarios')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver usuarios' })).toBeVisible();
  });
});
