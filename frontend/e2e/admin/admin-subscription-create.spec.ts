import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-subscription-create
 * Admin new-subscription wizard: customer picker, package select, payment
 * method, confirm dialog → POST /subscriptions/admin-create/.
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

const CUSTOMERS: AdminUser[] = [
  {
    id: 21, email: 'carla@kore.com', first_name: 'Carla', last_name: 'Ruiz', full_name: 'Carla Ruiz',
    phone: '', role: 'customer', is_active: true, must_change_password: false,
    date_joined: '2026-02-01T10:00:00Z', last_login: null,
    has_active_subscription: false, sessions_used_total: 0, sessions_total_total: 0,
  },
  {
    id: 22, email: 'diego@kore.com', first_name: 'Diego', last_name: 'Mora', full_name: 'Diego Mora',
    phone: '', role: 'customer', is_active: true, must_change_password: false,
    date_joined: '2026-02-05T10:00:00Z', last_login: null,
    has_active_subscription: false, sessions_used_total: 0, sessions_total_total: 0,
  },
];

// Detail response for the selected customer — no active subscription → "create" mode.
const CUSTOMER_DETAIL = {
  ...CUSTOMERS[0],
  subscriptions: [],
  assigned_trainer: null,
  assigned_clients: null,
};

const PACKAGES = [
  {
    id: 1, title: 'Plan Esencial', category: 'personalizado',
    sessions_count: 8, session_duration_minutes: 60, price: '300000', currency: 'COP',
    validity_days: 30, is_active: true,
  },
  {
    id: 2, title: 'Plan Dúo', category: 'semi_personalizado',
    sessions_count: 12, session_duration_minutes: 60, price: '450000', currency: 'COP',
    validity_days: 60, is_active: true,
  },
];

const CREATED_SUB = {
  id: 77, customer_id: 21, customer_email: 'carla@kore.com', customer_name: 'Carla Ruiz',
  package: {
    id: 1, title: 'Plan Esencial', category: 'personalizado',
    sessions_count: 8, session_duration_minutes: 60, price: '300000', currency: 'COP', validity_days: 30,
  },
  sessions_total: 8, sessions_used: 0, sessions_remaining: 8,
  status: 'active', starts_at: '2026-07-04T00:00:00Z', expires_at: '2026-08-03T00:00:00Z',
  is_recurring: false, next_billing_date: null, billing_failed_at: null,
  is_duo: false, guest_info: null, created_at: '2026-07-04T00:00:00Z', updated_at: '2026-07-04T00:00:00Z',
};

type WizardOpts = {
  postStatus?: number;
  postBody?: unknown;
};

async function mockWizard(
  page: import('@playwright/test').Page,
  { postStatus = 201, postBody = CREATED_SUB }: WizardOpts = {},
) {
  // Package catalog — single page, no `next`.
  await page.route('**/api/packages/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: PACKAGES.length, next: null, previous: null, results: PACKAGES }),
    });
  });

  // Admin users — list for the picker, detail for the selected customer.
  await page.route('**/api/admin/users/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const url = route.request().url();
    if (url.match(/\/admin\/users\/\d+\//)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CUSTOMER_DETAIL),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: CUSTOMERS.length, next: null, previous: null, results: CUSTOMERS }),
    });
  });

  // Subscriptions — admin-create POST + detail GET (after the success redirect).
  await page.route('**/api/subscriptions/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === 'POST' && url.includes('/admin-create/')) {
      await route.fulfill({
        status: postStatus,
        contentType: 'application/json',
        body: JSON.stringify(postBody),
      });
      return;
    }
    if (req.method() === 'GET' && url.includes('/renewal-history/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CREATED_SUB),
      });
      return;
    }
    await route.fallback();
  });
}

test.describe(
  'Admin Subscription Create',
  { tag: [...FlowTags.ADMIN_SUBSCRIPTION_CREATE, RoleTags.ADMIN] },
  () => {
    test.beforeEach(async ({ page }) => {
      await mockLoginAsAdmin(page);
    });

    test('renders the customer picker', async ({ page }) => {
      await mockWizard(page);
      await page.goto('/admin-platform/subscriptions/new');

      await expect(page.getByText('Selecciona el cliente')).toBeVisible();
      await expect(page.getByPlaceholder('Buscar por email o nombre…')).toBeVisible();
      await expect(page.getByRole('button', { name: /Carla Ruiz/ })).toBeVisible();
    });

    test('selecting a customer reveals the package step', async ({ page }) => {
      await mockWizard(page);
      await page.goto('/admin-platform/subscriptions/new');

      await page.getByRole('button', { name: /Carla Ruiz/ }).click();

      await expect(page.getByRole('button', { name: /Plan Esencial/ })).toBeVisible();
    });

    test('completing the wizard redirects to the subscriptions list', async ({ page }) => {
      await mockWizard(page);
      await page.goto('/admin-platform/subscriptions/new');

      await page.getByRole('button', { name: /Carla Ruiz/ }).click();
      await page.getByRole('button', { name: /Plan Esencial/ }).click();
      await page.getByRole('button', { name: 'Transferencia' }).click();
      await page.getByRole('button', { name: 'Crear suscripción' }).click();

      const postReq = page.waitForRequest(
        (r) => r.method() === 'POST' && r.url().includes('/api/subscriptions/admin-create/'),
      );
      await page.getByRole('button', { name: 'Confirmar' }).click();
      await postReq;

      await expect(page).toHaveURL(/\/subscriptions\/detail\?id=77/);
    });

    test('shows an error when admin-create fails', async ({ page }) => {
      await mockWizard(page, {
        postStatus: 400,
        postBody: { detail: 'El cliente ya tiene una suscripción activa.' },
      });
      await page.goto('/admin-platform/subscriptions/new');

      await page.getByRole('button', { name: /Carla Ruiz/ }).click();
      await page.getByRole('button', { name: /Plan Esencial/ }).click();
      await page.getByRole('button', { name: 'Crear suscripción' }).click();
      await page.getByRole('button', { name: 'Confirmar' }).click();

      await expect(
        page.getByText('El cliente ya tiene una suscripción activa.'),
      ).toBeVisible();
      await expect(page).toHaveURL(/subscriptions\/new/);
    });

    test('a packages load failure surfaces the catalog error message', async ({ page }) => {
      await mockWizard(page);
      // Registered after mockWizard so it wins (LIFO) for the package catalog GET.
      await mockApiError(page, '**/api/packages/**', 500, {}, { method: 'GET' });

      await page.goto('/admin-platform/subscriptions/new');
      await page.getByRole('button', { name: /Carla Ruiz/ }).click();

      await expect(page.getByText('No se pudieron cargar los paquetes.')).toBeVisible();
    });

    test('the picker explains when every customer has an active plan', async ({ page }) => {
      await mockWizard(page);
      // Override the roster (LIFO): same customers, but every one with an active plan.
      await page.route('**/api/admin/users/**', async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const busy = CUSTOMERS.map((c) => ({ ...c, has_active_subscription: true }));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: busy.length, next: null, previous: null, results: busy }),
        });
      });

      await page.goto('/admin-platform/subscriptions/new');

      await expect(
        page.getByText(/Todos los clientes de esta búsqueda ya tienen plan activo/),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: /Carla Ruiz/ })).toHaveCount(0);
    });
  },
);
