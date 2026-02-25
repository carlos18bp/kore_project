import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Session Detail Modal (opened from program detail page).
 * Uses mocked API responses to exercise status badges, cancel flow,
 * reschedule button, and various booking states.
 */
test.describe('Session Detail Modal (mocked)', { tag: [...FlowTags.BOOKING_SESSION_DETAIL, RoleTags.USER] }, () => {

  const futureSlotStart = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
  const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

  const mockSubscription = {
    id: 11,
    customer_email: 'e2e@kore.com',
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    sessions_total: 4,
    sessions_used: 1,
    sessions_remaining: 3,
    status: 'active',
    starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
    next_billing_date: null,
  };

  const mockBookingConfirmed = {
    id: 800,
    customer_id: 1,
    package: { id: 6, title: 'Paquete Pro', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 60 },
    slot: { id: 9000, trainer_id: 1, starts_at: futureSlotStart.toISOString(), ends_at: futureSlotEnd.toISOString(), is_active: true, is_blocked: false },
    trainer: { id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco', email: 'german@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá, Colombia', session_duration_minutes: 60 },
    subscription_id_display: 11,
    status: 'confirmed',
    notes: '',
    canceled_reason: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  function setupMocks(page: import('@playwright/test').Page, booking: typeof mockBookingConfirmed | null) {
    return Promise.all([
      page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
      }),
      page.route('**/api/bookings/*/cancel/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...booking, status: 'canceled', canceled_reason: 'Test reason' }),
        });
      }),
      page.route('**/api/bookings/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/upcoming-reminder') || url.includes('/cancel/')) {
          await route.fallback();
          return;
        }
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              count: booking ? 1 : 0,
              next: null,
              previous: null,
              results: booking ? [booking] : [],
            }),
          });
          return;
        }
        await route.fallback();
      }),
      page.route('**/api/subscriptions/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/payments/') || url.includes('/cancel/')) {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSubscription] }),
        });
      }),
    ]);
  }

  function getSessionDialog(page: import('@playwright/test').Page) {
    return page.getByRole('dialog', { name: 'Detalle de Sesión' });
  }

  async function openSessionModal(page: import('@playwright/test').Page) {
    // Click the booking row button to open the modal
    const bookingRow = page.getByRole('button', { name: /Confirmada|Pendiente|Cancelada/ });
    await bookingRow.click();
    await expect(getSessionDialog(page)).toBeVisible({ timeout: 5_000 });
  }

  async function expectConfirmedSessionDetails(dialog: import('@playwright/test').Locator) {
    await expect(dialog.getByText('Detalle de Sesión')).toBeVisible();
    await expect(dialog.getByText('Confirmada')).toBeVisible();
    await expect(dialog.getByText('Entrenamiento Kóre')).toBeVisible();
    await expect(dialog.getByText('Germán Franco')).toBeVisible();
    await expect(dialog.getByText('Bogotá, Colombia')).toBeVisible();
  }

  test('renders confirmed booking modal with status badge and details', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page, mockBookingConfirmed);
    await page.goto('/my-programs/program/11');
    await expect(page.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);
    const dialog = getSessionDialog(page);

    await expectConfirmedSessionDetails(dialog);

    // Action buttons (canModify = true because 48h from now > 24h threshold)
    await expect(page.getByRole('button', { name: 'Reprogramar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  test('cancel flow: opens confirmation, fills reason, confirms', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page, mockBookingConfirmed);
    await page.goto('/my-programs/program/11');
    await expect(page.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);

    // Open cancel confirmation
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Cancelar sesión')).toBeVisible();
    await expect(page.getByText('¿Estás seguro que deseas cancelar esta sesión?')).toBeVisible();

    // Fill reason
    await page.getByPlaceholder('Motivo de cancelación (opcional)').fill('Test reason');

    // Confirm cancellation
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    // Modal should close after successful cancellation
    await expect(page.getByText('Detalle de Sesión')).not.toBeVisible({ timeout: 10_000 });
  });

  test('cancel "Volver" goes back to action buttons', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page, mockBookingConfirmed);
    await page.goto('/my-programs/program/11');
    await expect(page.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);

    // Open cancel confirmation
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Cancelar sesión')).toBeVisible();

    // Click "Volver"
    await page.getByRole('button', { name: 'Volver' }).click();

    // Cancel form should close, action buttons should be visible again
    await expect(page.getByText('Cancelar sesión')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Reprogramar' })).toBeVisible();
  });

  test('reschedule button navigates to /book-session', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page, mockBookingConfirmed);
    await page.goto('/my-programs/program/11');
    await expect(page.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);

    await page.getByRole('button', { name: 'Reprogramar' }).click();
    await page.waitForURL(/\/book-session/);
  });

  test('renders canceled booking without action buttons', async ({ page }) => {
    const canceledBooking = {
      ...mockBookingConfirmed,
      status: 'canceled',
      canceled_reason: 'No puedo asistir',
    };
    await mockLoginAsTestUser(page);
    await setupMocks(page, canceledBooking);
    await page.goto('/my-programs/program/11');
    await expect(page.getByRole('button', { name: 'Pasadas' })).toBeVisible({ timeout: 10_000 });

    // Canceled bookings show in "Pasadas" tab
    await page.getByRole('button', { name: 'Pasadas' }).click();
    await expect(page.getByRole('button', { name: /Cancelada/ })).toBeVisible({ timeout: 10_000 });

    const bookingRow = page.getByRole('button', { name: /Cancelada/ });
    await bookingRow.click();
    await expect(getSessionDialog(page)).toBeVisible({ timeout: 5_000 });

    // Cancel reason
    await expect(page.getByText('No puedo asistir')).toBeVisible();

    // Action buttons should NOT be visible for canceled bookings
    await expect(page.getByRole('button', { name: 'Reprogramar' })).not.toBeVisible();
  });

  test('renders pending booking with Pendiente badge', async ({ page }) => {
    const pendingBooking = { ...mockBookingConfirmed, status: 'pending' };
    await mockLoginAsTestUser(page);
    await setupMocks(page, pendingBooking);
    await page.goto('/my-programs/program/11');
    await expect(page.getByRole('button', { name: /Pendiente/ })).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);

    await expect(getSessionDialog(page).getByText('Pendiente')).toBeVisible();
  });

  test('shows modification warning when session is within 24h', async ({ page }) => {
    const soonSlotStart = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6h from now
    const soonSlotEnd = new Date(soonSlotStart.getTime() + 60 * 60 * 1000);
    const soonBooking = {
      ...mockBookingConfirmed,
      slot: { ...mockBookingConfirmed.slot, starts_at: soonSlotStart.toISOString(), ends_at: soonSlotEnd.toISOString() },
    };
    await mockLoginAsTestUser(page);
    await setupMocks(page, soonBooking);
    await page.goto('/my-programs/program/11');
    await expect(page.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);

    // Warning text about 24h modification limit
    await expect(page.getByText(/No se puede modificar a menos de 24h/)).toBeVisible();

    // Buttons should be disabled
    const reprogramarBtn = page.getByRole('button', { name: 'Reprogramar' });
    const cancelarBtn = page.getByRole('button', { name: 'Cancelar' });
    await expect(reprogramarBtn).toBeDisabled();
    await expect(cancelarBtn).toBeDisabled();
  });

  test('close button dismisses the modal', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupMocks(page, mockBookingConfirmed);
    await page.goto('/my-programs/program/11');
    await expect(page.getByRole('button', { name: /Confirmada/ })).toBeVisible({ timeout: 10_000 });

    await openSessionModal(page);
    await expect(getSessionDialog(page)).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByText('Detalle de Sesión')).not.toBeVisible();
  });
});
