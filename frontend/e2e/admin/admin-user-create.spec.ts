import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-user-create
 * Admin "inscribir usuario" form: render, client validation, successful
 * POST /admin/users/ with the enrollment success screen, and server-side
 * field errors surfaced back onto the form.
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
  subscriptions: unknown[];
  assigned_trainer: null;
  assigned_clients: null;
};

const CREATED_USER: AdminUserDetail = {
  id: 42,
  email: 'nuevo@kore.com',
  first_name: 'Nuevo',
  last_name: 'Usuario',
  full_name: 'Nuevo Usuario',
  phone: '+57 300 0000000',
  role: 'trainer',
  is_active: true,
  must_change_password: true,
  date_joined: '2026-07-04T10:00:00Z',
  last_login: null,
  has_active_subscription: false,
  sessions_used_total: 0,
  sessions_total_total: 0,
  subscriptions: [],
  assigned_trainer: null,
  assigned_clients: null,
};

test.describe('Admin User Create', { tag: [...FlowTags.ADMIN_USER_CREATE, RoleTags.ADMIN] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
  });

  test('renders the create-user form including the role selector', async ({ page }) => {
    await page.goto('/admin-platform/users/new');

    await expect(page.getByRole('heading', { name: 'Inscribir nuevo usuario' })).toBeVisible();
    await expect(page.getByPlaceholder('usuario@ejemplo.com')).toBeVisible();
    await expect(page.getByPlaceholder('Ana')).toBeVisible();
    await expect(page.getByPlaceholder('Martínez')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cliente/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrenador/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear y enviar credenciales' })).toBeVisible();
  });

  test('client-side validation shows required-field errors on empty submit', async ({ page }) => {
    await page.goto('/admin-platform/users/new');

    await page.getByRole('button', { name: 'Crear y enviar credenciales' }).click();

    // No POST fires; the form stays on screen with "Requerido" markers.
    await expect(page.getByText('Requerido').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inscribir nuevo usuario' })).toBeVisible();
  });

  test('submitting a valid form shows the enrollment success screen', async ({
    page,
  }) => {
    await page.route('**/api/admin/users/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(CREATED_USER),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/admin-platform/users/new');
    await expect(page.getByRole('heading', { name: 'Inscribir nuevo usuario' })).toBeVisible();

    await page.getByPlaceholder('usuario@ejemplo.com').fill('nuevo@kore.com');
    await page.getByPlaceholder('Ana').fill('Nuevo');
    await page.getByPlaceholder('Martínez').fill('Usuario');
    await page.getByPlaceholder('+57 300 1234567').fill('+57 300 0000000');
    await page.getByRole('button', { name: /Entrenador/ }).click();

    const reqPromise = page.waitForRequest(
      (r) => r.url().includes('/api/admin/users/') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Crear y enviar credenciales' }).click();
    const req = await reqPromise;
    expect(req.postDataJSON()).toMatchObject({
      email: 'nuevo@kore.com',
      first_name: 'Nuevo',
      last_name: 'Usuario',
      role: 'trainer',
    });

    // Success screen.
    await expect(page.getByRole('heading', { name: 'Usuario inscrito' })).toBeVisible();
    await expect(page.getByText('nuevo@kore.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inscribir otro' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver lista de usuarios' })).toBeVisible();
  });

  test('server-side field errors from a 400 response are surfaced on the form', async ({ page }) => {
    await page.route('**/api/admin/users/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ email: ['Ya existe un usuario con este correo.'] }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/admin-platform/users/new');

    await page.getByPlaceholder('usuario@ejemplo.com').fill('dup@kore.com');
    await page.getByPlaceholder('Ana').fill('Dup');
    await page.getByPlaceholder('Martínez').fill('Licado');
    await page.getByRole('button', { name: 'Crear y enviar credenciales' }).click();

    await expect(page.getByText('Ya existe un usuario con este correo.')).toBeVisible();
    // Still on the form, not on the success screen.
    await expect(page.getByRole('heading', { name: 'Inscribir nuevo usuario' })).toBeVisible();
  });

  test('an invalid email format shows the inline validation error without submitting', async ({
    page,
  }) => {
    await page.goto('/admin-platform/users/new');

    // A domain without a TLD passes the browser's native type="email" check,
    // so submission reaches the form's own rule (/.+@.+\..+/) and is rejected there.
    await page.getByPlaceholder('usuario@ejemplo.com').fill('ana@dominio');
    await page.getByPlaceholder('Ana').fill('Ana');
    await page.getByPlaceholder('Martínez').fill('Martínez');
    await page.getByRole('button', { name: 'Crear y enviar credenciales' }).click();

    await expect(page.getByText('Email inválido')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inscribir nuevo usuario' })).toBeVisible();
  });

  test('a 500 on create keeps the form actionable for a retry', async ({ page }) => {
    // Non-field failure: the page has no generic error banner, so the observable
    // contract is graceful degradation — form intact, submit re-enabled, no success.
    await mockApiError(
      page,
      '**/api/admin/users/',
      500,
      { detail: 'Error interno del servidor.' },
      { method: 'POST' },
    );

    await page.goto('/admin-platform/users/new');
    await page.getByPlaceholder('usuario@ejemplo.com').fill('otra@kore.com');
    await page.getByPlaceholder('Ana').fill('Otra');
    await page.getByPlaceholder('Martínez').fill('Persona');

    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/admin/users/') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Crear y enviar credenciales' }).click();
    await respPromise;

    await expect(page.getByRole('heading', { name: 'Inscribir nuevo usuario' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Usuario inscrito' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Crear y enviar credenciales' })).toBeEnabled();
  });
});
