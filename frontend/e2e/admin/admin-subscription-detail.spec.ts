import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-subscription-detail
 * Admin subscription detail (?id=): render, status edit + save (PATCH),
 * manual renewal (POST admin-renew), delete (DELETE admin-delete).
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

function makeSub(overrides: Partial<AdminSubscription> = {}): AdminSubscription {
  return {
    id: 5, customer_id: 31, customer_email: 'marta@kore.com', customer_name: 'Marta Lopez',
    package: {
      id: 3, title: 'Plan Personalizado Pro', category: 'personalizado',
      sessions_count: 12, session_duration_minutes: 60, price: '480000', currency: 'COP', validity_days: 60,
    },
    sessions_total: 12, sessions_used: 4, sessions_remaining: 8,
    status: 'active', starts_at: '2026-06-01T00:00:00Z', expires_at: '2026-07-31T00:00:00Z',
    is_recurring: false, next_billing_date: null, billing_failed_at: null,
    is_duo: false, guest_info: null, created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

async function mockDetail(page: import('@playwright/test').Page, sub: AdminSubscription) {
  await page.route('**/api/subscriptions/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (url.match(/\/subscriptions\/\d+\/renewal-history\//)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (method === 'POST' && url.includes('/admin-renew/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sub) });
      return;
    }
    if (method === 'DELETE' && url.includes('/admin-delete/')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (method === 'PATCH' && url.match(/\/subscriptions\/\d+\//)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sub) });
      return;
    }
    if (method === 'GET' && url.match(/\/subscriptions\/\d+\/(\?|$)/)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sub) });
      return;
    }
    if (method === 'GET') {
      // List refetch (e.g. after a delete redirect) — empty roster.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/subscriptions/category-counts/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ personalizado: 0, semi_personalizado: 0, terapeutico: 0 }),
    });
  });
}

test.describe(
  'Admin Subscription Detail',
  { tag: [...FlowTags.ADMIN_SUBSCRIPTION_DETAIL, RoleTags.ADMIN] },
  () => {
    test.beforeEach(async ({ page }) => {
      await mockLoginAsAdmin(page);
    });

    test('renders the subscription detail', { tag: ['@outcome:display'] }, async ({ page }) => {
      // quality: allow-no-interaction (la clase display de este flow ES el render de la vista; no hay acción previa que ejecutar)
      // quality: allow-deep-link (el backoffice exige sesión de staff inyectada por cookie; no hay ruta de UI pública hasta esta vista)
      await mockDetail(page, makeSub());
      await page.goto('/admin-platform/subscriptions/detail?id=5');

      await expect(page.getByText('Suscripción #5')).toBeVisible();
      await expect(page.getByText('Marta Lopez')).toBeVisible();
      await expect(page.getByText('Información del paquete')).toBeVisible();
    });

    test('saving a changed status sends a PATCH', async ({ page }) => {
      await mockDetail(page, makeSub());
      await page.goto('/admin-platform/subscriptions/detail?id=5');
      await expect(page.getByText('Marta Lopez')).toBeVisible();

      // Flip the status pill to make the form dirty and enable "Guardar cambios".
      await page.getByRole('button', { name: 'Expirada' }).click();

      const patchReq = page.waitForRequest(
        (r) => r.method() === 'PATCH' && r.url().match(/\/api\/subscriptions\/5\//) !== null,
      );
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await patchReq;
    });

    test('renewing an expired subscription posts to admin-renew', async ({ page }) => {
      await mockDetail(page, makeSub({ status: 'expired' }));
      await page.goto('/admin-platform/subscriptions/detail?id=5');
      await expect(page.getByText('Marta Lopez')).toBeVisible();

      await page.getByRole('button', { name: 'Renovar manualmente' }).click();

      const renewReq = page.waitForRequest(
        (r) => r.method() === 'POST' && r.url().includes('/api/subscriptions/5/admin-renew/'),
      );
      await page.getByRole('button', { name: 'Sí, renovar' }).click();
      await renewReq;
    });

    test('renewal is disabled for an active subscription', async ({ page }) => {
      await mockDetail(page, makeSub());
      await page.goto('/admin-platform/subscriptions/detail?id=5');
      await expect(page.getByText('Marta Lopez')).toBeVisible();

      await expect(
        page.getByText('La renovación manual sólo aplica a suscripciones expiradas o canceladas.'),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Renovar manualmente' })).toBeDisabled();
    });

    test('deleting via the modal redirects to the list', async ({ page }) => {
      await mockDetail(page, makeSub());
      await page.goto('/admin-platform/subscriptions/detail?id=5');
      await expect(page.getByText('Marta Lopez')).toBeVisible();

      await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

      const deleteReq = page.waitForRequest(
        (r) => r.method() === 'DELETE' && r.url().includes('/api/subscriptions/5/admin-delete/'),
      );
      await page.getByRole('button', { name: 'Eliminar permanentemente' }).click();
      await deleteReq;

      await page.waitForURL('**/admin-platform/subscriptions');
      // The delete redirected off the detail page onto the subscriptions list.
      await expect(page).toHaveURL(/\/admin-platform\/subscriptions$/);
    });

    test('a rejected delete shows the error banner and stays on the detail', { tag: ['@outcome:error'] }, async ({ page }) => {
      await mockDetail(page, makeSub());
      // Registered after mockDetail so the DELETE is answered with a 409 (LIFO).
      await mockApiError(
        page,
        '**/api/subscriptions/5/admin-delete/',
        409,
        { detail: 'No se puede eliminar: la suscripción tiene pagos en curso.' },
        { method: 'DELETE' },
      );

      await page.goto('/admin-platform/subscriptions/detail?id=5');
      await expect(page.getByText('Marta Lopez')).toBeVisible();

      await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
      await page.getByRole('button', { name: 'Eliminar permanentemente' }).click();

      await expect(
        page.getByText('No se puede eliminar: la suscripción tiene pagos en curso.'),
      ).toBeVisible();
      await expect(page).toHaveURL(/subscriptions\/detail\?id=5/);
    });

    test('a detail load failure shows the load error instead of the subscription', { tag: ['@outcome:failure'] }, async ({ page }) => {
      // quality: allow-no-interaction (el fallo se induce desde la API; no hay acción de usuario que lo dispare — el estado degradado ES lo verificado)
      // quality: allow-deep-link (el backoffice exige sesión de staff inyectada por cookie; no hay ruta de UI pública hasta esta vista)
      await mockApiError(page, '**/api/subscriptions/5/', 500, {}, { method: 'GET' });

      await page.goto('/admin-platform/subscriptions/detail?id=5');

      // El par importa: sin la aserción negativa, un render a medias con el
      // banner encima también pasaría, y el punto es que la suscripción NO se
      // muestra cuando no se pudo cargar.
      await expect(page.getByText('No se pudo cargar la suscripción.')).toHaveCount(1);
      await expect(page.getByText('Marta Lopez')).toHaveCount(0);
    });

  },
);
