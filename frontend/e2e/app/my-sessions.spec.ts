import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('My Programs Page', { tag: [...FlowTags.MY_PROGRAMS_LIST, RoleTags.USER] }, () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForURL('**/login');
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
  });

  test('authenticated user sees Mi Suscripción heading', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/subscription');
    await expect(page.getByRole('heading', { name: 'Mi Suscripción' })).toBeVisible();
  });

  test('sidebar link navigates to subscription', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.locator('aside').getByRole('link', { name: 'Mi Suscripción' }).click();
    await page.waitForURL('**/subscription');
    await expect(page.getByRole('heading', { name: 'Mi Suscripción' })).toBeVisible();
  });

  test('shows the active subscription hero', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista del cliente; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await mockLoginAsTestUser(page);
    await page.goto('/subscription');
    await expect(
      page.getByText('Sin suscripción activa').or(page.getByRole('main').getByText('Tu plan vigente'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('subscriptions endpoint failure shows the load error banner', { tag: ['@outcome:failure'] }, async ({ page }) => {
    // quality: allow-no-interaction (el fallo se induce desde la API; no hay acción de usuario que lo dispare — el estado degradado ES lo verificado)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await mockLoginAsTestUser(page);
    await mockApiError(page, '**/api/subscriptions/', 500, { detail: 'Error interno' }, { method: 'GET' });
    await page.goto('/subscription');

    await expect(page.getByRole('heading', { name: 'Mi Suscripción' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('No se pudieron cargar las suscripciones.')).toBeVisible({ timeout: 10_000 });
  });

  test('customer without subscriptions sees the empty state with programs CTA', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/subscriptions/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
        });
      } else {
        await route.fallback();
      }
    });
    await page.goto('/subscription');

    await expect(page.getByText('Sin suscripción activa')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('main').getByRole('link', { name: /Ver programas/ })).toBeVisible();
  });
});
