import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-subscriptions-list
 * Admin subscription roster: render rows, status filter, category tabs,
 * pagination, empty state.
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

const SUBS: AdminSubscription[] = [
  {
    id: 101, customer_id: 11, customer_email: 'ana@kore.com', customer_name: 'Ana García',
    package: {
      id: 1, title: 'Plan Personalizado Pro', category: 'personalizado',
      sessions_count: 12, session_duration_minutes: 60, price: '480000', currency: 'COP', validity_days: 60,
    },
    sessions_total: 12, sessions_used: 4, sessions_remaining: 8,
    status: 'active', starts_at: '2026-06-01T00:00:00Z', expires_at: '2026-07-31T00:00:00Z',
    is_recurring: false, next_billing_date: null, billing_failed_at: null,
    is_duo: false, guest_info: null, created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 102, customer_id: 12, customer_email: 'luis@kore.com', customer_name: 'Luis Pérez',
    package: {
      id: 2, title: 'Plan Terapéutico', category: 'terapeutico',
      sessions_count: 8, session_duration_minutes: 45, price: '360000', currency: 'COP', validity_days: 30,
    },
    sessions_total: 8, sessions_used: 8, sessions_remaining: 0,
    status: 'expired', starts_at: '2026-04-01T00:00:00Z', expires_at: '2026-05-01T00:00:00Z',
    is_recurring: false, next_billing_date: null, billing_failed_at: null,
    is_duo: false, guest_info: null, created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
  },
];

const CATEGORY_COUNTS = { personalizado: 3, semi_personalizado: 5, terapeutico: 2 };

type MockOpts = {
  results?: AdminSubscription[];
  count?: number;
  counts?: typeof CATEGORY_COUNTS;
};

async function mockSubscriptions(
  page: import('@playwright/test').Page,
  { results = SUBS, count = 25, counts = CATEGORY_COUNTS }: MockOpts = {},
) {
  await page.route('**/api/subscriptions/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const url = route.request().url();
    if (url.includes('/category-counts/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(counts),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count, next: null, previous: null, results }),
    });
  });
}

test.describe(
  'Admin Subscriptions List',
  { tag: [...FlowTags.ADMIN_SUBSCRIPTIONS_LIST, RoleTags.ADMIN] },
  () => {
    test.beforeEach(async ({ page }) => {
      await mockLoginAsAdmin(page);
    });

    test('renders subscription rows with their customer email', async ({ page }) => {
      await mockSubscriptions(page);
      await page.goto('/admin-platform/subscriptions');

      await expect(page.getByPlaceholder('Buscar cliente, email o paquete…')).toBeVisible();
      // SubRow renders the same content in a desktop grid and a mobile card,
      // so both copies live in the DOM — assert the first visible one.
      await expect(page.getByText('Ana García').first()).toBeVisible();
      await expect(page.getByText('Plan Personalizado Pro').first()).toBeVisible();
      await expect(page.getByText('Luis Pérez').first()).toBeVisible();
    });

    test('status filter refetches with the status param', async ({ page }) => {
      await mockSubscriptions(page);
      await page.goto('/admin-platform/subscriptions');
      await expect(page.getByText('Ana García').first()).toBeVisible();

      const req = page.waitForRequest(
        (r) => r.url().includes('/api/subscriptions/') && r.url().includes('status=expired'),
      );
      await page.getByRole('button', { name: 'Expirada' }).click();
      await req;
    });

    test('category tab refetches with the category param', async ({ page }) => {
      await mockSubscriptions(page);
      await page.goto('/admin-platform/subscriptions');
      await expect(page.getByText('Ana García').first()).toBeVisible();

      const req = page.waitForRequest(
        (r) =>
          r.url().includes('/api/subscriptions/') && r.url().includes('category=personalizado'),
      );
      await page.getByRole('button', { name: 'Personalizada' }).click();
      await req;
    });

    test('pagination refetches the next page', async ({ page }) => {
      await mockSubscriptions(page, { count: 25 });
      await page.goto('/admin-platform/subscriptions');
      await expect(page.getByText('Ana García').first()).toBeVisible();

      const req = page.waitForRequest(
        (r) => r.url().includes('/api/subscriptions/') && r.url().includes('page=2'),
      );
      await page.getByRole('button', { name: /Siguiente/ }).click();
      await req;
    });

    test('empty state when there are no subscriptions', async ({ page }) => {
      await mockSubscriptions(page, { results: [], count: 0 });
      await page.goto('/admin-platform/subscriptions');

      await expect(page.getByText('Sin suscripciones')).toBeVisible();
    });
  },
);
