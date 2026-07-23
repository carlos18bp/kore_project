import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-user-detail
 * Admin user-detail page (?id=11): identity/role/status render, trainer-assignment
 * select, toggle-active (suspend), and reset-password (reenviar credenciales).
 */

type AdminUserDetail = {
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
  subscriptions: {
    id: number;
    package: { title: string; category: 'personalizado' | 'semi_personalizado' | 'terapeutico' };
    status: 'active' | 'expired' | 'canceled';
    starts_at: string;
    expires_at: string;
    sessions_used: number;
    sessions_total: number;
    role: 'host' | 'guest' | 'individual';
  }[];
  assigned_trainer: { id: number; first_name: string; last_name: string } | null;
  assigned_clients: null;
};

type Trainer = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  specialty: string;
  bio: string;
  location: string;
  session_duration_minutes: number;
};

const TRAINERS: Trainer[] = [
  {
    id: 1, user_id: 100, first_name: 'Germán', last_name: 'Franco', email: 'german@kore.com',
    specialty: '', bio: '', location: 'KÓRE Studio', session_duration_minutes: 60,
  },
  {
    id: 2, user_id: 101, first_name: 'Laura', last_name: 'Gómez', email: 'laura@kore.com',
    specialty: '', bio: '', location: 'KÓRE Studio', session_duration_minutes: 60,
  },
];

const DETAIL: AdminUserDetail = {
  id: 11,
  email: 'ana@kore.com',
  first_name: 'Ana',
  last_name: 'García',
  full_name: 'Ana García',
  phone: '+57 300 1234567',
  role: 'customer',
  is_active: true,
  must_change_password: false,
  date_joined: '2026-01-10T10:00:00Z',
  last_login: '2026-07-01T10:00:00Z',
  has_active_subscription: true,
  sessions_used_total: 3,
  sessions_total_total: 10,
  subscriptions: [
    {
      id: 5,
      package: { title: 'Plan Kore', category: 'personalizado' },
      status: 'active',
      starts_at: '2026-06-01T10:00:00Z',
      expires_at: '2026-07-31T10:00:00Z',
      sessions_used: 3,
      sessions_total: 10,
      role: 'individual',
    },
  ],
  assigned_trainer: { id: 1, first_name: 'Germán', last_name: 'Franco' },
  assigned_clients: null,
};

async function mockDetailPage(
  page: import('@playwright/test').Page,
  detail: AdminUserDetail = DETAIL,
) {
  // GET (fetchById) + PATCH (assignTrainer / patchUser) on the same URL.
  await page.route('**/api/admin/users/11/', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detail),
      });
    } else if (method === 'PATCH') {
      const body = (route.request().postDataJSON() ?? {}) as { assigned_trainer_id?: number | null };
      const nextTrainer =
        body.assigned_trainer_id == null
          ? null
          : { id: body.assigned_trainer_id, first_name: 'Laura', last_name: 'Gómez' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...detail, assigned_trainer: nextTrainer }),
      });
    } else {
      await route.fallback();
    }
  });

  // Trainers list feeding the assignment <select> (bookingStore.fetchTrainers).
  await page.route('**/api/trainers/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: TRAINERS.length, next: null, previous: null, results: TRAINERS }),
    });
  });

  // Action endpoints — registered last so they win LIFO for their exact URLs.
  await page.route('**/api/admin/users/11/toggle-active/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...detail, is_active: !detail.is_active }),
    });
  });
  await page.route('**/api/admin/users/11/reset-password/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'ok' }),
    });
  });
}

test.describe('Admin User Detail', { tag: [...FlowTags.ADMIN_USER_DETAIL, RoleTags.ADMIN] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
  });

  test('renders the user identity, role, status, subscription', async ({ page }) => {
    await mockDetailPage(page);
    await page.goto('/admin-platform/users/detail?id=11');

    await expect(page.getByRole('heading', { name: 'Ana García' })).toBeVisible();
    await expect(page.getByText('ana@kore.com').first()).toBeVisible();
    await expect(page.getByText('♀ Cliente')).toBeVisible();
    await expect(page.getByText('● Activo')).toBeVisible();
    await expect(page.getByText('Suscripciones (1)')).toBeVisible();
    await expect(page.getByText('Plan Kore').first()).toBeVisible();
  });

  test('the trainer select shows the currently assigned trainer', async ({ page }) => {
    await mockDetailPage(page);
    await page.goto('/admin-platform/users/detail?id=11');

    const select = page.getByRole('combobox');
    await expect(select).toBeVisible();
    // Value becomes '1' once the trainers list resolves (option id 1 exists).
    await expect(select).toHaveValue('1');
  });

  test('selecting a different trainer PATCHes the assignment', async ({ page }) => {
    await mockDetailPage(page);
    await page.goto('/admin-platform/users/detail?id=11');

    const select = page.getByRole('combobox');
    await expect(select).toHaveValue('1');

    const reqPromise = page.waitForRequest(
      (r) => r.url().includes('/api/admin/users/11/') && r.method() === 'PATCH',
    );
    await select.selectOption({ label: 'Laura Gómez' });
    const req = await reqPromise;
    expect(req.postDataJSON()).toMatchObject({ assigned_trainer_id: 2 });
  });

  test('suspending the account reflects the new active status', async ({
    page,
  }) => {
    await mockDetailPage(page);
    await page.goto('/admin-platform/users/detail?id=11');
    await expect(page.getByRole('heading', { name: 'Ana García' })).toBeVisible();

    const reqPromise = page.waitForRequest(
      (r) => r.url().includes('/api/admin/users/11/toggle-active/') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Suspender' }).click();
    await reqPromise;

    await expect(page.getByText('● Inactivo')).toBeVisible();
  });

  test('confirming reenviar credenciales posts to reset-password', async ({ page }) => {
    await mockDetailPage(page);
    await page.goto('/admin-platform/users/detail?id=11');
    await expect(page.getByRole('heading', { name: 'Ana García' })).toBeVisible();

    await page.getByRole('button', { name: 'Reenviar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const reqPromise = page.waitForRequest(
      (r) => r.url().includes('/api/admin/users/11/reset-password/') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Sí, reenviar' }).click();
    await reqPromise;

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('an unknown user id shows the load error message', async ({ page }) => {
    await mockApiError(page, '**/api/admin/users/999/', 404, { detail: 'No encontrado.' });

    await page.goto('/admin-platform/users/detail?id=999');

    await expect(page.getByText('No se pudo cargar el usuario.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ana García' })).toHaveCount(0);
  });

  test('a rejected trainer assignment shows the inline field error', async ({ page }) => {
    await mockDetailPage(page);
    // Registered after mockDetailPage so the PATCH is answered with a 400 (LIFO);
    // GET keeps falling through to the detail mock.
    await mockApiError(
      page,
      '**/api/admin/users/11/',
      400,
      { assigned_trainer_id: ['No se puede asignar este entrenador.'] },
      { method: 'PATCH' },
    );

    await page.goto('/admin-platform/users/detail?id=11');
    const select = page.getByRole('combobox');
    await expect(select).toHaveValue('1');

    await select.selectOption({ label: 'Laura Gómez' });

    await expect(page.getByText('No se puede asignar este entrenador.')).toBeVisible();
  });
});
