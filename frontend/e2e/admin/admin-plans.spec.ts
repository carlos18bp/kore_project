import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-plans
 * Admin plan catalog: render by category, create a plan (POST /packages/),
 * edit an existing plan (PATCH /packages/{id}/), empty category state.
 */

type PackageCategory = 'personalizado' | 'semi_personalizado' | 'terapeutico';

type AdminPackage = {
  id: number;
  title: string;
  short_description: string;
  description: string;
  category: PackageCategory;
  sessions_count: number;
  session_duration_minutes: number;
  price: string;
  currency: string;
  validity_days: number;
  terms_and_conditions: string;
  is_active: boolean;
  order: number;
  created_at: string;
  updated_at: string;
};

function makePackage(overrides: Partial<AdminPackage> & Pick<AdminPackage, 'id' | 'title' | 'category'>): AdminPackage {
  return {
    short_description: 'Plan de entrenamiento personalizado.',
    description: '',
    sessions_count: 10,
    session_duration_minutes: 60,
    price: '300000',
    currency: 'COP',
    validity_days: 30,
    terms_and_conditions: '',
    is_active: true,
    order: 0,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

// personalizado: 1 plan (unique "Editar"); semi: 1 plan; terapeutico: none (empty-state tab).
const PACKAGES: AdminPackage[] = [
  makePackage({ id: 101, title: 'Plan Base Personalizado', category: 'personalizado', order: 1 }),
  makePackage({ id: 102, title: 'Plan Pareja Dúo', category: 'semi_personalizado', order: 1 }),
];

async function mockPackages(
  page: import('@playwright/test').Page,
  opts: { results?: AdminPackage[]; created?: AdminPackage; updated?: AdminPackage } = {},
) {
  const { results = PACKAGES, created, updated } = opts;
  await page.route('**/api/packages/**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: results.length, next: null, previous: null, results }),
      });
    }
    if (method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created ?? {}),
      });
    }
    if (method === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated ?? {}),
      });
    }
    return route.continue();
  });
}

test.describe('Admin Plans', { tag: [...FlowTags.ADMIN_PLANS, RoleTags.ADMIN] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
  });

  test('renders the plan catalog for the default category', async ({ page }) => {
    await mockPackages(page);
    await page.goto('/admin-platform/plans');

    await expect(page.getByRole('heading', { name: 'Gestión de planes' })).toBeVisible();
    await expect(page.getByText('Plan Base Personalizado')).toBeVisible();
    await expect(page.getByRole('button', { name: /Crear plan/ })).toBeVisible();
  });

  test('opens the create modal with its form fields', async ({ page }) => {
    await mockPackages(page);
    await page.goto('/admin-platform/plans');
    await expect(page.getByText('Plan Base Personalizado')).toBeVisible();

    await page.getByRole('button', { name: /Crear plan/ }).click();

    await expect(page.getByText('Crear plan de entrenamiento')).toBeVisible();
    await expect(page.getByPlaceholder('Ej. Plan Estándar')).toBeVisible();
    await expect(page.getByText('Número de sesiones')).toBeVisible();
    await expect(page.getByText('Duración por sesión (min)')).toBeVisible();
    await expect(page.getByText('Precio (COP)')).toBeVisible();
    await expect(page.getByText('Vigencia (días)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Personalizado', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terapéutico', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear plan', exact: true })).toBeVisible();
  });

  test('creating a plan renders the new plan in the catalog', async ({ page }) => {
    const created = makePackage({
      id: 201,
      title: 'Plan Test E2E',
      category: 'personalizado',
      sessions_count: 1,
      session_duration_minutes: 60,
      price: '300000',
      validity_days: 30,
      order: 2,
    });
    await mockPackages(page, { created });
    await page.goto('/admin-platform/plans');
    await expect(page.getByText('Plan Base Personalizado')).toBeVisible();

    await page.getByRole('button', { name: /Crear plan/ }).click();
    await expect(page.getByText('Crear plan de entrenamiento')).toBeVisible();

    await page.getByPlaceholder('Ej. Plan Estándar').fill('Plan Test E2E');
    await page.getByPlaceholder('0').fill('300000');

    const postReq = page.waitForRequest(
      (r) => r.url().includes('/api/packages/') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    const req = await postReq;
    expect(req.postDataJSON()).toMatchObject({ title: 'Plan Test E2E', category: 'personalizado' });

    // Modal closes and the newly created plan appears in the catalog.
    await expect(page.getByText('Crear plan de entrenamiento')).toBeHidden();
    await expect(page.getByText('Plan Test E2E')).toBeVisible();
  });

  test('editing a plan renders the updated plan', async ({ page }) => {
    const updated = makePackage({
      id: 101,
      title: 'Plan Base Actualizado',
      category: 'personalizado',
      order: 1,
    });
    await mockPackages(page, { updated });
    await page.goto('/admin-platform/plans');
    await expect(page.getByText('Plan Base Personalizado')).toBeVisible();

    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByText('Editando plan #101')).toBeVisible();

    await page.getByPlaceholder('Ej. Plan Estándar').fill('Plan Base Actualizado');

    const patchReq = page.waitForRequest(
      (r) => r.url().includes('/api/packages/101/') && r.method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await patchReq;

    await expect(page.getByText('Editando plan #101')).toBeHidden();
    await expect(page.getByText('Plan Base Actualizado')).toBeVisible();
  });

  test('shows the empty state for a category with no plans', async ({ page }) => {
    await mockPackages(page);
    await page.goto('/admin-platform/plans');
    await expect(page.getByText('Plan Base Personalizado')).toBeVisible();

    await page.getByRole('button', { name: /Terapéutica/ }).click();
    await expect(page.getByText('Sin planes en esta categoría')).toBeVisible();
  });

  test('a rejected plan save surfaces the server message in the modal', async ({ page }) => {
    await mockPackages(page);
    // Registered after mockPackages so the create POST is answered with a 400 (LIFO).
    await mockApiError(
      page,
      '**/api/packages/**',
      400,
      { title: ['Ya existe un plan con este nombre.'] },
      { method: 'POST' },
    );

    await page.goto('/admin-platform/plans');
    await expect(page.getByText('Plan Base Personalizado')).toBeVisible();

    await page.getByRole('button', { name: /Crear plan/ }).click();
    await expect(page.getByText('Crear plan de entrenamiento')).toBeVisible();
    await page.getByPlaceholder('Ej. Plan Estándar').fill('Plan Duplicado');
    await page.getByPlaceholder('0').fill('250000');
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();

    // The server message renders in both the modal-level and field-level error
    // boxes; assert the first so it is unambiguous under strict mode.
    await expect(page.getByText('title: Ya existe un plan con este nombre.').first()).toBeVisible();
    // The modal stays open so the admin can correct and retry.
    await expect(page.getByText('Crear plan de entrenamiento')).toBeVisible();
  });

  test('a catalog load failure shows the plans error banner', async ({ page }) => {
    await mockApiError(page, '**/api/packages/**', 500, {}, { method: 'GET' });

    await page.goto('/admin-platform/plans');

    await expect(page.getByText('No se pudieron cargar los planes.')).toBeVisible();
  });
});
