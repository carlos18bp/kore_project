import { test, expect, E2E_USER, injectAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the DUO (Plan Pareja) guest-invitation flow on /subscription.
 *
 * The GuestCard renders only when the detail subscription is:
 *   status === 'active' && package.category === 'semi_personalizado' && !is_guest
 * (see app/(app)/subscription/page.tsx). guest_info drives which sub-state shows:
 *   - null / 'revoked'  → invite form ("Invitar compañero/a")
 *   - 'pending'         → "Revocar invitación"
 *   - 'accepted'        → "Revocar acceso"
 *
 * Store endpoints (lib/stores/subscriptionStore.ts):
 *   - inviteGuest  → POST /subscriptions/{id}/invite-guest/   body { email }
 *   - revokeGuest  → POST /subscriptions/{id}/revoke-guest/
 *   - acceptPendingInvitation → POST /subscriptions/accept-invite/  body { token }
 *   - fetchPendingInvitation  → GET  /subscriptions/pending-invitation/
 *
 * Mirrors subscription.spec.ts: injectAuthCookies + a custom route helper that
 * returns the subscription list. Routes are registered LIFO — the broad
 * `**\/api/subscriptions/**` catch-all is registered FIRST so the more specific
 * per-action routes registered after it win.
 */
test.describe('Subscription DUO guest invite (mocked)', { tag: [...FlowTags.SUBSCRIPTION_DUO_INVITE, RoleTags.USER] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await expect(page).toHaveURL('about:blank');
  });

  // A DUO-eligible (semi_personalizado), active, non-guest subscription.
  const duoSubBase = {
    id: 42,
    customer_email: E2E_USER.email,
    package: {
      id: 8,
      title: 'Plan Pareja',
      category: 'semi_personalizado',
      sessions_count: 12,
      session_duration_minutes: 60,
      price: '480000',
      currency: 'COP',
      validity_days: 60,
    },
    sessions_total: 12,
    sessions_used: 2,
    sessions_remaining: 10,
    sessions_completed: 2,
    status: 'active',
    starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 55 * 86400000).toISOString(),
    next_billing_date: null,
    is_recurring: false,
    billing_failed_at: null,
    is_guest: false,
    guest_info: null as Record<string, unknown> | null,
  };

  // A plain (non-DUO) active subscription — used for the "accept invitation"
  // scenario where the invited customer just needs a healthy page state.
  const plainActiveSub = {
    ...duoSubBase,
    id: 50,
    package: { ...duoSubBase.package, id: 5, title: 'Plan Personalizado', category: 'personalizado' },
    guest_info: null,
  };

  const pendingInvite = {
    token: 'invite-token-abc',
    host_name: 'Carlos Ruiz',
    package_title: 'Plan Pareja',
    invited_email: E2E_USER.email,
  };

  async function setupDuoMock(
    page: import('@playwright/test').Page,
    { sub, pendingInvitation = null }: { sub: Record<string, unknown> | null; pendingInvitation?: Record<string, unknown> | null },
  ) {
    // Bookings — layout's upcoming-reminder + page's fetchBookings.
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
    });

    // Subscriptions list catch-all — registered FIRST so the specific action
    // routes below take LIFO priority for their own URLs.
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: sub ? 1 : 0, next: null, previous: null, results: sub ? [sub] : [] }),
      });
    });

    await page.route('**/api/subscriptions/*/payments/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/subscriptions/*/renewal-history/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/subscriptions/*/cancel/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...(sub ?? {}), status: 'canceled' }) });
    });
    await page.route('**/api/subscriptions/*/invite-guest/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: 'Invitación enviada.' }) });
    });
    await page.route('**/api/subscriptions/*/revoke-guest/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: 'Invitación revocada.' }) });
    });
    await page.route('**/api/subscriptions/accept-invite/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ host_name: 'Carlos Ruiz', package_title: 'Plan Pareja' }) });
    });
    await page.route('**/api/subscriptions/pending-invitation/**', async (route) => {
      if (pendingInvitation) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pendingInvitation) });
      } else {
        await route.fulfill({ status: 204 });
      }
    });
  }

  test('renders the guest invite card for a duo (semi_personalizado) subscription', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDuoMock(page, { sub: { ...duoSubBase, guest_info: null } });
    await page.goto('/subscription');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Mi Suscripción', level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByRole('heading', { name: 'Compañero/a de entrenamiento' })).toBeVisible();
    await expect(main.getByPlaceholder('correo@ejemplo.com')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Invitar compañero/a' })).toBeVisible();
  });

  test('inviting a guest by email fires POST invite-guest with the email', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDuoMock(page, { sub: { ...duoSubBase, guest_info: null } });
    await page.goto('/subscription');

    const main = page.getByRole('main');
    const emailInput = main.getByPlaceholder('correo@ejemplo.com');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill('companero@kore.com');

    const inviteRequest = page.waitForRequest(
      (r) => r.url().includes('/subscriptions/42/invite-guest/') && r.method() === 'POST',
    );
    await main.getByRole('button', { name: 'Invitar compañero/a' }).click();
    const req = await inviteRequest;
    expect(req.postDataJSON()).toMatchObject({ email: 'companero@kore.com' });
  });

  test('revoking a pending guest invitation fires POST revoke-guest', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDuoMock(page, {
      sub: {
        ...duoSubBase,
        guest_info: { status: 'pending', invited_email: 'companero@kore.com', guest_name: null, guest_user_id: null },
      },
    });
    await page.goto('/subscription');

    const main = page.getByRole('main');
    const revokeButton = main.getByRole('button', { name: 'Revocar invitación' });
    await expect(revokeButton).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText(/companero@kore\.com/)).toBeVisible();

    const revokeRequest = page.waitForRequest(
      (r) => r.url().includes('/subscriptions/42/revoke-guest/') && r.method() === 'POST',
    );
    await revokeButton.click();
    await revokeRequest;
  });

  test('accepting a pending invitation fires POST accept-invite and shows confirmation', async ({ page }) => {
    await injectAuthCookies(page);
    await setupDuoMock(page, { sub: plainActiveSub, pendingInvitation: pendingInvite });
    await page.goto('/subscription');

    const main = page.getByRole('main');
    await expect(main.getByText('Tienes una invitación pendiente')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText(/Carlos Ruiz/)).toBeVisible();

    const acceptRequest = page.waitForRequest(
      (r) => r.url().includes('/subscriptions/accept-invite/') && r.method() === 'POST',
    );
    await main.getByRole('button', { name: 'Aceptar invitación' }).click();
    const req = await acceptRequest;
    expect(req.postDataJSON()).toMatchObject({ token: 'invite-token-abc' });

    await expect(main.getByText('¡Invitación aceptada!')).toBeVisible();
  });
});
