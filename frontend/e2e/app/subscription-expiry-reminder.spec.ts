import { test, expect, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';

test.describe('Subscription Expiry Reminder (mocked)', () => {
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

    await loginAsTestUser(page);
    await page.waitForTimeout(2_000);
    await expect(page.getByText('Tu suscripción está por vencer')).not.toBeVisible();
  });
});
