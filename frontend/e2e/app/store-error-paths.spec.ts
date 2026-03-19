import { test, expect, setupDefaultApiMocks, injectAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests targeting store error branches and auth hydration catch paths
 * not exercised by the main test suites.
 */

test.describe('authStore hydrate error branches', { tag: [...FlowTags.APP_STORE_ERROR_PATHS, RoleTags.USER] }, () => {
  test('hydrate clears auth when kore_user cookie contains invalid JSON', async ({ page }) => {
    // Exercise authStore.ts:172-176 — JSON.parse catch clears auth and sets
    // hydrated:true / isAuthenticated:false so the login form remains visible.
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: '{invalid-json', domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));

    await page.goto('/login');

    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('hydrate clears auth when profile API returns 401', async ({ page }) => {
    // Exercise authStore.ts:188-191 — profile fetch catch clears auth and sets
    // hydrated:true / isAuthenticated:false so the login form remains visible.
    const validUser = JSON.stringify({
      id: 999, email: 'e2e@kore.com', first_name: 'Usuario',
      last_name: 'Prueba', phone: '', role: 'customer',
    });
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: encodeURIComponent(validUser), domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ detail: 'Token inválido.' }),
    }));
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));

    await page.goto('/login');

    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('bookingStore rescheduleBooking error branch', { tag: [...FlowTags.APP_STORE_ERROR_PATHS, RoleTags.USER] }, () => {
  const targetDay = new Date();
  targetDay.setDate(targetDay.getDate() + 2);
  // Skip Sunday (0) — shift to Monday
  if (targetDay.getDay() === 0) targetDay.setDate(targetDay.getDate() + 1);
  const tomorrow = targetDay; // keep variable name for downstream references
  // Use LOCAL date components (matching calendar display and WEEKDAY_WINDOWS generation)
  const dateIso = `${targetDay.getFullYear()}-${String(targetDay.getMonth() + 1).padStart(2, '0')}-${String(targetDay.getDate()).padStart(2, '0')}`;
  const dayNum = targetDay.getDate().toString();

  const mockTrainer = {
    id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco',
    email: 'g@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá',
    session_duration_minutes: 60,
  };
  // Build mock slot in LOCAL time (matching WEEKDAY_WINDOWS virtual slot generation)
  const mockSlot = {
    id: 601, trainer_id: 1,
    starts_at: new Date(`${dateIso}T10:00:00`).toISOString(),
    ends_at: new Date(`${dateIso}T11:00:00`).toISOString(),
    is_active: true, is_blocked: false,
  };
  const mockSubscription = {
    id: 11, customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    sessions_total: 4, sessions_used: 1, sessions_remaining: 3, status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
    next_billing_date: null,
  };
  const mockBooking = {
    id: 800, customer_id: 1,
    package: mockSubscription.package,
    slot: { id: 900, trainer_id: 1, starts_at: new Date(`${dateIso}T08:00:00`).toISOString(), ends_at: new Date(`${dateIso}T09:00:00`).toISOString(), is_active: true, is_blocked: false },
    trainer: mockTrainer, subscription_id_display: 11, status: 'confirmed',
    notes: '', canceled_reason: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  function slotLabel(slot: { starts_at: string; ends_at: string }) {
    // TimeSlotPicker defaults to 12h format (hour12: true)
    const fmt = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${fmt(slot.starts_at)} \u2014 ${fmt(slot.ends_at)}`;
  }

  async function setupRescheduleMocks(page: import('@playwright/test').Page) {
    // Use standard base mocks (auth, captcha, pending-assessments, expiry-reminder, etc.)
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);

    // Override with reschedule-specific mocks (LIFO: last registered wins)
    await page.route('**/api/trainers/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }),
    }));
    await page.route('**/api/availability-slots/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSlot] }),
    }));
    await page.route('**/api/subscriptions/', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSubscription] }),
    }));
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
      }
      if (url.includes('/reschedule/')) {
        return route.fulfill({
          status: 400, contentType: 'application/json',
          body: JSON.stringify({ detail: 'Slot no disponible para reprogramar.' }),
        });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockBooking] }),
      });
    });
  }

  async function selectSlotAndConfirm(page: import('@playwright/test').Page) {
    // Force-click the calendar day that has the mocked slot
    await page.getByText('Lun').waitFor({ state: 'visible', timeout: 10_000 });
    await page.evaluate((n) => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent?.trim() === n && !(btn as HTMLButtonElement).disabled) {
          const k = Object.keys(btn).find((key) => key.startsWith('__reactProps$'));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (k) { const p = (btn as any)[k]; if (typeof p?.onClick === 'function') p.onClick(); }
          break;
        }
      }
    }, dayNum);

    await page.getByRole('button', { name: slotLabel(mockSlot), exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: slotLabel(mockSlot), exact: true }).click();
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
  }

  test('rescheduleBooking API error shows message in booking confirmation', async ({ page }) => {
    // Exercise bookingStore.ts:380-387 — rescheduleBooking catch extracts the
    // detail message and sets error, which BookingConfirmation renders in the UI.
    await setupRescheduleMocks(page);

    await page.goto('/book-session?reschedule=800&subscription=11');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });

    await selectSlotAndConfirm(page);

    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Slot no disponible para reprogramar.')).toBeVisible({ timeout: 10_000 });
  });
});
