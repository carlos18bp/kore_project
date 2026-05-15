import { test, expect, injectAuthCookies, mockCaptchaSiteKey, mockAuthProfile } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Accept Duo Invite', { tag: [...FlowTags.AUTH_ACCEPT_INVITE, RoleTags.USER] }, () => {
  test('accepted state — shows success card and subscription link', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.route('**/api/subscriptions/accept-invite/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ accepted: true, subscription_id: 5, host_name: 'Pedro Ruiz', package_title: 'Plan Dúo Elite' }),
      });
    });
    await page.goto('/accept-invite?token=VALID_TOKEN');

    await expect(page.getByRole('heading', { name: '¡Invitación aceptada!' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plan Dúo Elite')).toBeVisible();
    const link = page.getByRole('link', { name: 'Ver mi suscripción' });
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain('/subscription');
  });

  test('requires_login state — shows login prompt with token preserved', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.route('**/api/subscriptions/accept-invite/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ requires_login: true, invited_email: 'other@kore.com', token: 'VALID_TOKEN' }),
      });
    });
    await page.goto('/accept-invite?token=VALID_TOKEN');

    await expect(page.getByRole('heading', { name: 'Inicia sesión para continuar' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('other@kore.com')).toBeVisible();
    const link = page.getByRole('link', { name: 'Iniciar sesión' }).last();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain('token=VALID_TOKEN');
  });

  test('requires_registration state — shows register prompt', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.route('**/api/subscriptions/accept-invite/', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ requires_registration: true, invited_email: 'new@kore.com', token: 'VALID_TOKEN' }),
      });
    });
    await page.goto('/accept-invite?token=VALID_TOKEN');

    await expect(page.getByRole('heading', { name: 'Crea tu cuenta para continuar' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('new@kore.com')).toBeVisible();
    const link = page.getByRole('link', { name: 'Crear cuenta' });
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain('invite_token=VALID_TOKEN');
  });

  test('error state — shows invalid invitation card', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.route('**/api/subscriptions/accept-invite/', async (route) => {
      await route.fulfill({
        status: 400, contentType: 'application/json',
        body: JSON.stringify({ detail: 'El token ha expirado o ya fue usado.' }),
      });
    });
    await page.goto('/accept-invite?token=EXPIRED_TOKEN');

    await expect(page.getByRole('heading', { name: 'Invitación inválida' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Volver al inicio' })).toBeVisible();
  });

  test('missing token — shows invalid card without API call', async ({ page }) => {
    await mockCaptchaSiteKey(page);
    await page.goto('/accept-invite');

    await expect(page.getByRole('heading', { name: 'Invitación inválida' })).toBeVisible({ timeout: 15_000 });
  });
});
