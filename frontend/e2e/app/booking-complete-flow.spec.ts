import { test, expect, loginAsTestUser, E2E_USER } from '../fixtures';

/**
 * Full booking flow tests that exercise BookingConfirmation, BookingSuccess,
 * TimeSlotPicker branches, and bookingStore actions via mocked API responses.
 *
 * The calendar has a chicken-and-egg problem: dates are disabled until slots
 * are loaded, but slots only load after a date is selected. We work around
 * this by using page.evaluate to remove the disabled attribute and triggering
 * a click, which lets React's handler fire and the mock API respond.
 */
test.describe('Complete Booking Flow (mocked)', () => {
  test.describe.configure({ mode: 'serial' });

  const mockTrainer = {
    id: 1,
    first_name: 'Germán',
    last_name: 'Franco',
    specialty: 'Entrenamiento funcional',
    session_duration_minutes: 60,
    location: 'Bogotá, Colombia',
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

  const mockSlots = [
    {
      id: 501,
      starts_at: `${dateStr}T10:00:00Z`,
      ends_at: `${dateStr}T11:00:00Z`,
      is_blocked: false,
      is_active: true,
      trainer_id: mockTrainer.id,
    },
    {
      id: 502,
      starts_at: `${dateStr}T14:00:00Z`,
      ends_at: `${dateStr}T15:00:00Z`,
      is_blocked: false,
      is_active: true,
      trainer_id: mockTrainer.id,
    },
  ];

  const mockSubscription = {
    id: 11,
    customer_email: E2E_USER.email,
    package: {
      id: 6,
      title: 'Paquete Pro',
      sessions_count: 4,
      session_duration_minutes: 60,
      price: '120000',
      currency: 'COP',
      validity_days: 60,
    },
    sessions_total: 4,
    sessions_used: 1,
    sessions_remaining: 3,
    status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
  };

  function setupMocks(page: import('@playwright/test').Page) {
    return Promise.all([
      page.route('**/api/trainers/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }),
        });
      }),
      page.route('**/api/availability-slots/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: mockSlots.length, next: null, previous: null, results: mockSlots }),
        });
      }),
      page.route('**/api/subscriptions/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSubscription] }),
        });
      }),
      page.route('**/api/bookings/upcoming-reminder/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(null),
        });
      }),
    ]);
  }

  /**
   * Helper: force-click a calendar day that is disabled (because slots aren't
   * loaded yet). React 18 uses event delegation and checks the fiber's
   * disabled prop, so we call the onClick handler directly via __reactProps.
   */
  async function forceClickCalendarDay(page: import('@playwright/test').Page, dayNum: string) {
    // Wait for the calendar to render (day name headers are always visible)
    await page.getByText('Lun').waitFor({ state: 'visible', timeout: 10_000 });
    await page.evaluate((num) => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === num) {
          const propsKey = Object.keys(btn).find(k => k.startsWith('__reactProps$'));
          if (propsKey) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const props = (btn as unknown as Record<string, any>)[propsKey];
            if (typeof props?.onClick === 'function') {
              props.onClick();
            }
          }
          break;
        }
      }
    }, dayNum);
  }

  test('full flow: select date → slot → confirmation → confirm booking → success', async ({ page }) => {
    await setupMocks(page);

    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 999,
            subscription_id_display: mockSubscription.id,
            status: 'confirmed',
            slot: mockSlots[0],
            trainer: mockTrainer,
            package: mockSubscription.package,
            customer_id: 1,
            notes: '',
            canceled_reason: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAsTestUser(page);
    await page.goto('/book-session');
    await expect(page.getByText('Agenda tu sesión')).toBeVisible();

    // Force-click the target date in the calendar
    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);

    // Wait for mocked slots to appear in the TimeSlotPicker
    await expect(page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first()).toBeVisible({ timeout: 10_000 });

    // Select the first slot
    await page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first().click();

    // Step 2 — Confirmation screen
    const main = page.getByRole('main');
    await expect(main.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText(E2E_USER.fullName)).toBeVisible();
    await expect(main.getByText(E2E_USER.email)).toBeVisible();

    // Subscription info (inside the confirmation panel, not the selector/header)
    const confirmPanel = main.locator('label:has-text("Programa") + p');
    await expect(confirmPanel.getByText(/Paquete Pro/)).toBeVisible();
    await expect(confirmPanel.getByText(/sesiones restantes/)).toBeVisible();

    // TrainerInfoPanel content
    await expect(main.getByText('60 min')).toBeVisible();
    await expect(main.getByText('En persona')).toBeVisible();

    // Click "Confirmar"
    await main.getByRole('button', { name: 'Confirmar' }).click();

    // Step 3 — Success modal (calendar is visible behind, so scope assertions to the modal)
    const modal = main.locator('.fixed.inset-0.z-50');
    await expect(modal.getByText('Esta reunión está programada')).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('Hemos enviado un correo electrónico')).toBeVisible();

    // Summary table
    await expect(modal.getByText('Entrenamiento Kóre')).toBeVisible();
    await expect(modal.getByText('Germán Franco')).toBeVisible();
    await expect(modal.getByText('Bogotá, Colombia')).toBeVisible();

    // Links
    await expect(modal.getByText('Reprogramar o Cancelar')).toBeVisible();
    await expect(modal.getByText('Agendar otra sesión')).toBeVisible();
  });

  test('confirmation step "Atrás" button returns to step 1', async ({ page }) => {
    await setupMocks(page);
    await loginAsTestUser(page);
    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expect(page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first()).toBeVisible({ timeout: 10_000 });
    await page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first().click();
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

    // Go back
    await page.getByRole('button', { name: 'Atrás' }).click();

    // Should return to step 1 — calendar and slots are visible (selectedDate is kept)
    await expect(page.getByText('Seleccionar horario')).toBeVisible();
    await expect(page.getByText('Lun', { exact: true })).toBeVisible();
  });

  test('success screen "Agendar otra sesión" resets to step 1', async ({ page }) => {
    await setupMocks(page);
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 999,
            subscription_id_display: mockSubscription.id,
            status: 'confirmed',
            slot: mockSlots[0],
            trainer: mockTrainer,
            package: mockSubscription.package,
            customer_id: 1,
            notes: '',
            canceled_reason: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAsTestUser(page);
    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expect(page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first()).toBeVisible({ timeout: 10_000 });
    await page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first().click();
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Esta reunión está programada')).toBeVisible({ timeout: 10_000 });

    // Click "Agendar otra sesión"
    await page.getByText('Agendar otra sesión').click();

    // Should return to step 1 — reset() clears selectedDate
    await expect(page.getByText('Selecciona una fecha en el calendario para ver los horarios disponibles.')).toBeVisible({ timeout: 10_000 });
  });

  test('time slot picker 12h/24h toggle changes format', async ({ page }) => {
    await setupMocks(page);
    await loginAsTestUser(page);
    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expect(page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first()).toBeVisible({ timeout: 10_000 });

    // Toggle to 12h
    const toggle12 = page.getByRole('button', { name: '12h' });
    const toggle24 = page.getByRole('button', { name: '24h' });
    await toggle12.click();
    // Should show AM/PM format
    await expect(page.getByText(/AM|PM|a\.?\s*m\.?|p\.?\s*m\.?/i).first()).toBeVisible();

    // Toggle back to 24h
    await toggle24.click();
  });

  test('booking error is displayed on confirmation screen', async ({ page }) => {
    await setupMocks(page);

    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'No quedan sesiones disponibles.' }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAsTestUser(page);
    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expect(page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first()).toBeVisible({ timeout: 10_000 });
    await page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first().click();
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

    // Confirm — should show error
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Error message should appear
    await expect(page.getByText('No quedan sesiones disponibles.')).toBeVisible({ timeout: 10_000 });
  });
});
