import { test, expect, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Subscription Expiry Reminder (mocked)', { tag: [...FlowTags.SUBSCRIPTION_EXPIRY_REMINDER, RoleTags.USER] }, () => {
  const reminderSubscription = {
    id: 33,
    customer_email: 'e2e@kore.com',
    package: {
      id: 6,
      title: 'Paquete Pro',
      sessions_count: 8,
      session_duration_minutes: 60,
      price: '240000',
      currency: 'COP',
      validity_days: 60,
    },
    sessions_total: 8,
    sessions_used: 3,
    sessions_remaining: 5,
    status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    next_billing_date: null,
    paused_at: null,
  };

  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page);
    await expect(page).toHaveURL('about:blank');
  });

  test('shows expiry reminder and dismisses with ack', async ({ page }) => {
    let ackCalled = false;
    await page.route('**/api/subscriptions/expiry-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reminderSubscription),
      });
    });
    await page.route(`**/api/subscriptions/${reminderSubscription.id}/expiry-reminder/ack/**`, async (route) => {
      ackCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    await loginAsTestUser(page);

    await expect(page.getByText('Tu suscripción está por vencer')).toBeVisible({ timeout: 10_000 });
    const ackResponse = page.waitForResponse(
      `**/api/subscriptions/${reminderSubscription.id}/expiry-reminder/ack/**`,
    );
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await ackResponse;

    await expect(page.getByText('Tu suscripción está por vencer')).not.toBeVisible();
    expect(ackCalled).toBe(true);
  });

  test('renew now navigates to checkout and acknowledges reminder', async ({ page }) => {
    let ackCalled = false;
    await page.route('**/api/subscriptions/expiry-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reminderSubscription),
      });
    });
    await page.route(`**/api/subscriptions/${reminderSubscription.id}/expiry-reminder/ack/**`, async (route) => {
      ackCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    await loginAsTestUser(page);

    await expect(page.getByText('Tu suscripción está por vencer')).toBeVisible({ timeout: 10_000 });
    const ackResponse = page.waitForResponse(
      `**/api/subscriptions/${reminderSubscription.id}/expiry-reminder/ack/**`,
    );
    await page.getByRole('link', { name: 'Renovar ahora' }).click();
    await ackResponse;

    await page.waitForURL(/\/checkout\?package=6/, { timeout: 15_000 });
    expect(ackCalled).toBe(true);
  });

  test('does not show reminder when API returns 204', async ({ page }) => {
    await page.route('**/api/subscriptions/expiry-reminder/**', async (route) => {
      await route.fulfill({
        status: 204,
      });
    });

    const reminderResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/subscriptions/expiry-reminder/') &&
        response.status() === 204,
    );
    await loginAsTestUser(page);
    await reminderResponse;
    await expect(page.getByText('Tu suscripción está por vencer')).not.toBeVisible();
  });

  test('fetchExpiryReminder API error sets expiryReminder to null and hides reminder', async ({ page }) => {
    await page.route('**/api/subscriptions/expiry-reminder/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Server error' }),
      });
    });

    const reminderResponse = page.waitForResponse(
      (response) => response.url().includes('/api/subscriptions/expiry-reminder/'),
    );
    await loginAsTestUser(page);
    await reminderResponse;

    await expect(page.getByText('Tu suscripción está por vencer')).not.toBeVisible();
  });

  test('acknowledgeExpiryReminder API error exercises catch branch', async ({ page }) => {
    let ackAttempted = false;
    await page.route('**/api/subscriptions/expiry-reminder/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reminderSubscription),
      });
    });
    await page.route(
      `**/api/subscriptions/${reminderSubscription.id}/expiry-reminder/ack/**`,
      async (route) => {
        ackAttempted = true;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Server error' }),
        });
      },
    );

    await loginAsTestUser(page);
    await expect(page.getByText('Tu suscripción está por vencer')).toBeVisible({ timeout: 10_000 });

    const ackResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/subscriptions/${reminderSubscription.id}/expiry-reminder/ack/`),
    );
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await ackResponse;

    expect(ackAttempted).toBe(true);
  });
});
