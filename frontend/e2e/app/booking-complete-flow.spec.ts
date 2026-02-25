import { test, expect, mockLoginAsTestUser, E2E_USER } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * Full booking flow tests that exercise BookingConfirmation, BookingSuccess,
 * TimeSlotPicker branches, and bookingStore actions via mocked API responses.
 *
 * The calendar has a chicken-and-egg problem: dates are disabled until slots
 * are loaded, but slots only load after a date is selected. We work around
 * this by using page.evaluate to remove the disabled attribute and triggering
 * a click, which lets React's handler fire and the mock API respond.
 */
test.describe('Complete Booking Flow (mocked)', { tag: [...FlowTags.BOOKING_COMPLETE_FLOW, RoleTags.USER] }, () => {
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

  function slotLabelFor(slot: { starts_at: string; ends_at: string }) {
    const formatTime = (isoString: string) => (
      new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
    return `${formatTime(slot.starts_at)} — ${formatTime(slot.ends_at)}`;
  }

  const primarySlotLabel = slotLabelFor(mockSlots[0]);

  async function expectPrimarySlotButton(page: import('@playwright/test').Page) {
    await expect(page.getByRole('button', { name: primarySlotLabel, exact: true })).toBeVisible({ timeout: 10_000 });
  }

  async function selectPrimarySlot(page: import('@playwright/test').Page) {
    const primarySlotButton = page.getByRole('button', { name: primarySlotLabel, exact: true });
    await expect(primarySlotButton).toBeVisible({ timeout: 10_000 });
    await primarySlotButton.click();
  }

  function setupMocks(page: import('@playwright/test').Page) {
    return Promise.all([
      page.route('**/api/trainers/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockTrainer] }),
        });
      }),
      page.route('**/api/availability-slots/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: mockSlots.length, next: null, previous: null, results: mockSlots }),
        });
      }),
      page.route('**/api/subscriptions/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSubscription] }),
        });
      }),
      page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
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

  async function goToConfirmationStep(page: import('@playwright/test').Page) {
    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expectPrimarySlotButton(page);
    await selectPrimarySlot(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
    return main;
  }

  async function mockSuccessfulBookingCreate(page: import('@playwright/test').Page) {
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
  }

  async function expectConfirmationDetails(main: import('@playwright/test').Locator) {
    await expect(main.getByText(E2E_USER.fullName)).toBeVisible();
    await expect(main.getByText(E2E_USER.email)).toBeVisible();

    await expect(main.getByText(/Paquete Pro .+ Sesión \d+ de \d+/)).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('60 min')).toBeVisible();
    await expect(main.getByText('En persona')).toBeVisible();
  }

  async function expectSuccessModal(main: import('@playwright/test').Locator) {
    const modal = main.locator('.fixed.inset-0.z-50');
    await expect(modal.getByText('Tu entrenamiento está agendado')).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('Hemos enviado un correo electrónico')).toBeVisible();
    await expect(modal.getByText('Entrenamiento presencial')).toBeVisible();
    await expect(modal.getByText('Germán Franco')).toBeVisible();
    await expect(modal.getByText('reprogramar o cancelar')).toBeVisible();
    await expect(modal.getByText('Agendar otra sesión')).toBeVisible();
  }

  test('full flow: select date → slot → confirmation → confirm booking → success', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page);
    await mockSuccessfulBookingCreate(page);

    const main = await goToConfirmationStep(page);
    await expectConfirmationDetails(main);
    await expect(main.getByRole('button', { name: 'Confirmar' })).toBeVisible();
    await main.getByRole('button', { name: 'Confirmar' }).click();

    await expectSuccessModal(main);
  });

  test('confirmation step "Atrás" button returns to step 1', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page);
    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expectPrimarySlotButton(page);
    await selectPrimarySlot(page);
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

    // Go back
    await page.getByRole('button', { name: 'Atrás' }).click();

    // Should return to step 1 — calendar and slots are visible (selectedDate is kept)
    await expect(page.getByText('Seleccionar horario')).toBeVisible();
    await expect(page.getByText('Lun', { exact: true })).toBeVisible();
  });

  test('success screen "Agendar otra sesión" resets to step 1', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page);
    await mockSuccessfulBookingCreate(page);

    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expectPrimarySlotButton(page);
    await selectPrimarySlot(page);
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Tu entrenamiento está agendado')).toBeVisible({ timeout: 10_000 });

    // Click "Agendar otra sesión"
    await page.getByText('Agendar otra sesión').click();

    // Should return to step 1 — reset() clears selectedDate
    await expect(page.getByText('Selecciona una fecha en el calendario para ver los horarios disponibles.')).toBeVisible({ timeout: 10_000 });
  });

  test('time slot picker 12h/24h toggle changes format', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page);
    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expectPrimarySlotButton(page);

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
    await mockLoginAsTestUser(page);
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

    await page.goto('/book-session');

    const dayNum = tomorrow.getDate().toString();
    await forceClickCalendarDay(page, dayNum);
    await expectPrimarySlotButton(page);
    await selectPrimarySlot(page);
    await expect(page.getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });

    // Confirm — should show error
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Error message should appear
    await expect(page.getByText('No quedan sesiones disponibles.')).toBeVisible({ timeout: 10_000 });
  });
});
