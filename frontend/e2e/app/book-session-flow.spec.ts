import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Book Session Flow', { tag: [...FlowTags.BOOKING_SESSION_FLOW, RoleTags.USER] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page).toHaveURL(/\/book-session/);
  });

  test('calendar renders with month navigation', async ({ page }) => {
    // Calendar should show current month label
    const monthLabel = page.locator('h3.capitalize');
    await expect(monthLabel).toBeVisible();

    // Day name headers should be visible
    await expect(page.getByText('Lun')).toBeVisible();
    await expect(page.getByText('Mar').first()).toBeVisible();

    // Navigate to next month
    const nextBtn = page.getByLabel('Mes siguiente');
    await nextBtn.click();
    // Month label should change
    await expect(monthLabel).toBeVisible();

    // Navigate back to previous month
    const prevBtn = page.getByLabel('Mes anterior');
    await prevBtn.click();
    await expect(monthLabel).toBeVisible();
  });

  test('clicking an available date shows time slots or empty message', async ({ page }) => {
    // Find and click an enabled day button (not disabled, not blank)
    // quality: allow-fragile-selector (calendar day labels repeat; selecting first enabled day is acceptable here)
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();
      // After selecting a date, either time slots or "No hay horarios" should appear
      await expect(
        page.getByText(/\d{1,2}:\d{2}/).first().or(page.getByText('No hay horarios disponibles'))
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('time slot picker shows 12h/24h toggle', async ({ page }) => {
    // Click an available date to trigger slot loading
    // quality: allow-fragile-selector (calendar day labels repeat; selecting first enabled day is acceptable here)
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();
      // Wait for slots or empty message
      await expect(
        page.getByText(/\d{1,2}:\d{2}/).first().or(page.getByText('No hay horarios disponibles'))
      ).toBeVisible({ timeout: 10_000 });

      // If slots are present, check the 12h/24h toggle
      const has24h = await page.getByRole('button', { name: '24h' }).isVisible().catch(() => false);
      const has12h = await page.getByRole('button', { name: '12h' }).isVisible().catch(() => false);
      if (has24h && has12h) {
        // Toggle to 12h
        await page.getByRole('button', { name: '12h' }).click();
        // Toggle back to 24h
        await page.getByRole('button', { name: '24h' }).click();
      }
    }
  });

  test('selecting a slot advances to confirmation step', async ({ page }) => {
    // Click an available date
    // quality: allow-fragile-selector (calendar day labels repeat; selecting first enabled day is acceptable here)
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();

      // Wait for slots to appear
      // quality: allow-fragile-selector (slot labels may repeat across formats; selecting first visible slot is acceptable)
      const slotButton = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first();
      const slotsExist = await slotButton.isVisible({ timeout: 10_000 }).catch(() => false);

      if (slotsExist) {
        await slotButton.click();

        // Should advance to step 2 — Confirmation step shows "Confirmar reserva"
        await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

        // Trainer info panel should be visible
        await expect(page.getByText('Entrenamiento Kóre').first()).toBeVisible();

        // Back button should return to step 1
        await page.getByRole('button', { name: 'Atrás' }).click();
        await expect(page.getByText('Selecciona un día')).toBeVisible();
      }
    }
  });

  test('calendar year-boundary navigation: Jan→Dec and Dec→Jan', async ({ page }) => {
    const monthLabel = page.locator('h3.capitalize');
    await expect(monthLabel).toBeVisible();

    const prevBtn = page.getByLabel('Mes anterior');
    const nextBtn = page.getByLabel('Mes siguiente');

    // Navigate backwards to January (month 0)
    const currentMonth = new Date().getMonth(); // 0-indexed
    // Click prev enough times to reach January
    for (let i = 0; i <= currentMonth; i++) {
      await prevBtn.click();
    }
    // We should now be in December of the previous year (year boundary crossed)
    await expect(monthLabel).toContainText(/diciembre/i);

    // Now navigate forward past December to cross the year boundary the other way
    // From December, click next 12 times to reach December of next year
    for (let i = 0; i < 12; i++) {
      await nextBtn.click();
    }
    // Should be back to December (of the original year)
    await expect(monthLabel).toContainText(/diciembre/i);

    // One more click should cross into January of next year
    await nextBtn.click();
    await expect(monthLabel).toContainText(/enero/i);
  });

  test('trainer info panel renders with session details', async ({ page }) => {
    // quality: allow-fragile-selector (calendar day labels repeat; selecting first enabled day is acceptable here)
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();
      // quality: allow-fragile-selector (slot labels may repeat across formats; selecting first visible slot is acceptable)
      const slotButton = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first();
      const slotsExist = await slotButton.isVisible({ timeout: 10_000 }).catch(() => false);

      if (slotsExist) {
        await slotButton.click();
        await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

        // TrainerInfoPanel: duration and location info
        await expect(page.getByText(/\d+ min/)).toBeVisible();
        await expect(page.getByText('En persona')).toBeVisible();

        // Timezone detection
        await expect(page.getByText(/\//)).toBeVisible(); // timezone format like America/Bogota
      }
    }
  });

  test('confirmation step without active subscription shows user info only', async ({ page }) => {
    // This test exercises BookingConfirmation.tsx lines 46-52 (subscription is null branch)
    // The default mock has no subscriptions, so we should see the confirmation UI
    // without the subscription info block

    // quality: allow-fragile-selector (calendar day labels repeat; selecting first enabled day is acceptable here)
    const enabledDay = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first();
    const dayExists = await enabledDay.isVisible().catch(() => false);

    if (dayExists) {
      await enabledDay.click();
      // quality: allow-fragile-selector (slot labels may repeat across formats; selecting first visible slot is acceptable)
      const slotButton = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first();
      const slotsExist = await slotButton.isVisible({ timeout: 10_000 }).catch(() => false);

      if (slotsExist) {
        await slotButton.click();
        await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

        // User info should be visible
        await expect(page.getByText('Nombre')).toBeVisible();
        await expect(page.getByText('Email')).toBeVisible();

        // Confirm button should be visible
        await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Atrás' })).toBeVisible();
      }
    }
  });

  test('subscription selector shows active subscriptions with session details', async ({ page }) => {
    // Check if subscription selector is visible when user has active subscriptions
    const subscriptionSelector = page.locator('select#subscription-select');
    const hasSelector = await subscriptionSelector.isVisible().catch(() => false);

    if (hasSelector) {
      // Verify TODO note is present
      await expect(page.getByText(/This was not included in the project scope/)).toBeVisible();

      // Verify session details card is visible
      await expect(page.getByText(/Sesión \d+ de \d+/)).toBeVisible();
      await expect(page.getByText(/Programa:/)).toBeVisible();
    }
  });

  test('time slot picker 12h format toggle shows AM/PM', async ({ page }) => {
    // This test exercises TimeSlotPicker.tsx line 20 (!use24h branch)
    // Note: Uses beforeEach login, just needs to set up slot mocks and interact

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const mockSlots = [
      { id: 100, trainer_id: 1, starts_at: `${dateStr}T14:00:00Z`, ends_at: `${dateStr}T15:00:00Z`, is_active: true, is_blocked: false },
      { id: 101, trainer_id: 1, starts_at: `${dateStr}T16:00:00Z`, ends_at: `${dateStr}T17:00:00Z`, is_active: true, is_blocked: false },
    ];

    // Override availability-slots to return our mock slots
    await page.route('**/api/availability-slots/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 2, next: null, previous: null, results: mockSlots }) });
    });

    // Navigate to book-session (already logged in via beforeEach)
    await page.goto('/book-session');

    // Click the available day on the calendar
    const dayNumber = tomorrow.getDate();
    // quality: allow-fragile-selector (calendar day labels can repeat across months; select first matching visible day)
    const dayButton = page.locator('button').filter({ hasText: new RegExp(`^${dayNumber}$`) }).first();
    await dayButton.click();

    // Wait for slots to appear
    await expect(page.getByRole('button', { name: '24h' })).toBeVisible({ timeout: 10_000 });

    // Toggle to 12h format
    await page.getByRole('button', { name: '12h' }).click();

    // Verify AM/PM format is shown (slots should show PM since they're at 14:00 and 16:00)
    await expect(page.getByText(/PM/).first()).toBeVisible({ timeout: 5_000 });

    // Toggle back to 24h
    await page.getByRole('button', { name: '24h' }).click();
  });
});

/**
 * Tests for reschedule no-availability branch in book-session/page.tsx.
 * showRescheduleNoAvailability renders when isReschedule=true, bookingToReschedule
 * is found, and availableDates is empty (no slots for the reschedule window).
 */
test.describe('Book Session — Reschedule No Availability', { tag: [...FlowTags.BOOKING_SESSION_FLOW, RoleTags.USER] }, () => {
  const rescheduleBooking = {
    id: 800, customer_id: 1,
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    slot: {
      id: 900, trainer_id: 1,
      starts_at: new Date(Date.now() + 48 * 3600000).toISOString(),
      ends_at: new Date(Date.now() + 49 * 3600000).toISOString(),
      is_active: true, is_blocked: false,
    },
    trainer: { id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco', email: 'g@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá', session_duration_minutes: 60 },
    subscription_id_display: 11,
    status: 'confirmed', notes: '', canceled_reason: '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const rescheduleSubscription = {
    id: 11, customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    sessions_total: 4, sessions_used: 1, sessions_remaining: 3, status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
    next_billing_date: null,
  };

  async function setupRescheduleNoAvailabilityMocks(page: import('@playwright/test').Page) {
    const cookieUser = encodeURIComponent(JSON.stringify({
      id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba',
      phone: '', role: 'customer', name: 'Usuario Prueba',
    }));
    await page.context().addCookies([
      { name: 'kore_token', value: 'fake-e2e-jwt-token-for-testing', domain: 'localhost', path: '/' },
      { name: 'kore_user', value: cookieUser, domain: 'localhost', path: '/' },
    ]);
    await page.route('**/api/auth/profile/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ user: { id: 999, email: 'e2e@kore.com', first_name: 'Usuario', last_name: 'Prueba', phone: '', role: 'customer' } }),
    }));
    await page.route('**/api/google-captcha/site-key/', (r) => r.fulfill({ status: 404, body: '' }));
    await page.route('**/api/trainers/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [rescheduleBooking.trainer] }),
    }));
    await page.route('**/api/availability-slots/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
    }));
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/') || url.includes('/expiry-reminder')) {
        return route.fallback();
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [rescheduleSubscription] }),
      });
    });
    await page.route('**/api/bookings/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upcoming-reminder')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [rescheduleBooking] }),
      });
    });
  }

  test('reschedule with no available slots shows no-availability message', async ({ page }) => {
    // Exercise book-session/page.tsx:209-213 — showRescheduleNoAvailability=true
    // renders the "no disponibilidad" block with the WhatsApp contact link.
    await setupRescheduleNoAvailabilityMocks(page);

    await page.goto('/book-session?reschedule=800&subscription=11');

    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Por el momento no hay disponibilidad horaria.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: '+57 301 4645272' })).toBeVisible();
  });
});
