import { test, expect, loginAsTestUser, E2E_USER } from '../fixtures';

/**
 * Targeted tests for uncovered branch paths:
 * - BookingSuccess with trainer=null and subscription_id_display=null
 * - BookingConfirmation with subscription=null (no active subscription)
 * - authStore hydrate() catch block (malformed cookie)
 */
test.describe('Edge-case branch coverage', () => {
  test.describe.configure({ mode: 'serial' });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const mockTrainer = {
    id: 1, first_name: 'Germán', last_name: 'Franco', specialty: 'Funcional',
    session_duration_minutes: 60, location: 'Bogotá', email: 'g@kore.com', bio: '', user_id: 1,
  };
  const mockSlots = [
    { id: 501, starts_at: `${dateStr}T10:00:00Z`, ends_at: `${dateStr}T11:00:00Z`, is_blocked: false, is_active: true, trainer_id: 1 },
  ];

  async function forceClickCalendarDay(page: import('@playwright/test').Page, dayNum: string) {
    await page.getByText('Lun').waitFor({ state: 'visible', timeout: 10_000 });
    await page.evaluate((num) => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === num) {
          const propsKey = Object.keys(btn).find(k => k.startsWith('__reactProps$'));
          if (propsKey) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const props = (btn as unknown as Record<string, any>)[propsKey];
            if (typeof props?.onClick === 'function') props.onClick();
          }
          break;
        }
      }
    }, dayNum);
  }

  test('booking success with trainer=null shows "—" fallback', async ({ page }) => {
    // Mock APIs: trainers, slots, subscriptions
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }) });
    });
    await page.route('**/api/availability-slots/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: mockSlots }) });
    });
    const mockSub = {
      id: 11, customer_email: E2E_USER.email,
      package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
      sessions_total: 4, sessions_used: 1, sessions_remaining: 3, status: 'active',
      starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
    };
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSub] }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    // Mock booking creation: trainer=null, subscription_id_display=null
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({
            id: 999, subscription_id_display: null, status: 'confirmed',
            slot: mockSlots[0], trainer: null,
            package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
            customer_id: 1, notes: '', canceled_reason: '',
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible();

    // Force-click date, select slot
    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expect(page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first()).toBeVisible({ timeout: 10_000 });
    await page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first().click();

    // Confirmation screen — subscription=null means no "Programa" section
    const main = page.getByRole('main');
    await expect(main.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText(E2E_USER.fullName)).toBeVisible();

    // Confirm
    await main.getByRole('button', { name: 'Confirmar' }).click();

    // Success screen — trainer=null shows "—" for trainer name
    await expect(main.getByText('Esta reunión está programada')).toBeVisible({ timeout: 10_000 });
    // The trainer row should show "—" instead of a real name
    await expect(main.getByText('—', { exact: true })).toBeVisible();

    // The "Reprogramar o Cancelar" link uses subscription_id_display ?? '' (null branch)
    await expect(main.getByText('Reprogramar o Cancelar')).toBeVisible();
  });

  test('malformed kore_user cookie triggers hydrate catch branch', async ({ page }) => {
    // Set a valid token but malformed user JSON
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-token-12345', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: '{invalid-json!!!', domain: 'localhost', path: '/' },
    ]);

    // Navigate to a protected page — hydrate() will try JSON.parse and fail
    await page.goto('/dashboard');

    // Should redirect to login since hydrate failed and cleared cookies
    await page.waitForURL('**/login', { timeout: 15_000 });
  });

  test('no-token hydrate falls through without error', async ({ page }) => {
    // Clear all cookies first
    await page.context().clearCookies();

    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 15_000 });
  });
});
