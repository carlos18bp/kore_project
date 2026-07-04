import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-users-list
 * Admin user roster: render, search, role filter, create CTA, empty state.
 */

type AdminUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: 'customer' | 'trainer' | 'admin';
  is_active: boolean;
  must_change_password: boolean;
  date_joined: string;
  last_login: string | null;
  has_active_subscription: boolean;
  sessions_used_total: number;
  sessions_total_total: number;
};

const USERS: AdminUser[] = [
  {
    id: 11, email: 'ana@kore.com', first_name: 'Ana', last_name: 'García', full_name: 'Ana García',
    phone: '', role: 'customer', is_active: true, must_change_password: false,
    date_joined: '2026-01-10T10:00:00Z', last_login: '2026-07-01T10:00:00Z',
    has_active_subscription: true, sessions_used_total: 3, sessions_total_total: 10,
  },
  {
    id: 12, email: 'luis@kore.com', first_name: 'Luis', last_name: 'Pérez', full_name: 'Luis Pérez',
    phone: '', role: 'trainer', is_active: true, must_change_password: false,
    date_joined: '2026-01-10T10:00:00Z', last_login: null,
    has_active_subscription: false, sessions_used_total: 0, sessions_total_total: 0,
  },
];

async function mockUsersList(page: import('@playwright/test').Page, results: AdminUser[] = USERS) {
  await page.route('**/api/admin/users/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: results.length, next: null, previous: null, results }),
    });
  });
}

test.describe('Admin Users List', { tag: [...FlowTags.ADMIN_USERS_LIST, RoleTags.ADMIN] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
  });

  test('renders the user roster entries with their emails', async ({ page }) => {
    await mockUsersList(page);
    await page.goto('/admin-platform/users');

    await expect(page.getByPlaceholder('Buscar por nombre o email…')).toBeVisible();
    await expect(page.getByText('Ana García')).toBeVisible();
    await expect(page.getByText('ana@kore.com')).toBeVisible();
    await expect(page.getByText('Luis Pérez')).toBeVisible();
  });

  test('filtering by role refetches with the role param', async ({ page }) => {
    await mockUsersList(page);
    await page.route('**/api/admin/trainers/assignment-summary/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ active_customers: 5, assigned: 4, unassigned: 1, per_trainer: [] }),
      }),
    );
    await page.goto('/admin-platform/users');
    await expect(page.getByText('Ana García')).toBeVisible();

    const req = page.waitForRequest(
      (r) => r.url().includes('/api/admin/users/') && r.url().includes('role=trainer'),
    );
    await page.getByRole('button', { name: 'Entrenadores' }).click();
    await req;
  });

  test('search submits the typed query', async ({ page }) => {
    await mockUsersList(page);
    await page.goto('/admin-platform/users');
    const input = page.getByPlaceholder('Buscar por nombre o email…');
    await input.fill('Ana');

    const req = page.waitForRequest(
      (r) => r.url().includes('/api/admin/users/') && r.url().includes('search=Ana'),
    );
    await input.press('Enter');
    await req;

    await expect(input).toHaveValue('Ana');
  });

  test('the create-user CTA navigates to /admin-platform/users/new', async ({ page }) => {
    await mockUsersList(page);
    await page.goto('/admin-platform/users');
    await page.getByRole('link', { name: /Inscribir usuario/ }).click();

    await expect(page).toHaveURL(/\/admin-platform\/users\/new/);
  });

  test('empty state when there are no users', async ({ page }) => {
    await mockUsersList(page, []);
    await page.goto('/admin-platform/users');
    await expect(page.getByText('Sin usuarios')).toBeVisible();
  });
});
