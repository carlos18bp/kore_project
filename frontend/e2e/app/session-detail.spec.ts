import { test, expect, loginAsTestUser, setupDefaultApiMocks } from '../fixtures';

/**
 * E2E tests for the Session Detail page (/my-sessions/program/:id/session/:id).
 * Uses mocked API responses to exercise status badges, cancel modal,
 * reschedule button, not-found state, and various booking states.
 */
test.describe('Session Detail Page (mocked)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page);
  });

  const futureSlotStart = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
  const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

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

  function setupBookingMock(page: import('@playwright/test').Page, booking: typeof mockBookingConfirmed | null) {
    return Promise.all([
      page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
      }),
      // Cancel endpoint must be registered before the general bookings route
      page.route('**/api/bookings/*/cancel/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...booking, status: 'canceled', canceled_reason: 'Test reason' }),
        });
      }),
      page.route('**/api/bookings/**', async (route) => {
        const url = route.request().url();
        // Let more specific routes handle these
        if (url.includes('/upcoming-reminder') || url.includes('/cancel/')) {
          await route.fallback();
          return;
        }
        // List bookings for subscription
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
    ]);
  }

  test('renders confirmed booking with status badge and details', async ({ page }) => {
    await setupBookingMock(page, mockBookingConfirmed);
    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/800');

    // Breadcrumb
    await expect(page.getByText('Detalle de Sesión')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('main').getByRole('link', { name: 'Mis Sesiones' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Programa' })).toBeVisible();

    // Status badge — Confirmada
    await expect(page.getByText('Confirmada')).toBeVisible();

    // Details card
    await expect(page.getByText('Entrenamiento Kóre')).toBeVisible();
    await expect(page.getByText('Germán Franco')).toBeVisible();
    await expect(page.getByText('Bogotá, Colombia')).toBeVisible();
    await expect(page.getByText('Paquete Pro')).toBeVisible();

    // Action buttons (canModify = true because 48h from now > 24h threshold)
    await expect(page.getByRole('button', { name: 'Reprogramar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  test('cancel modal opens, fills reason, and confirms cancellation', async ({ page }) => {
    await setupBookingMock(page, mockBookingConfirmed);
    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/800');
    await expect(page.getByText('Confirmada')).toBeVisible({ timeout: 10_000 });

    // Open cancel modal
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Cancelar sesión')).toBeVisible();
    await expect(page.getByText('¿Estás seguro que deseas cancelar esta sesión?')).toBeVisible();

    // Fill reason
    await page.getByPlaceholder('Motivo de cancelación (opcional)').fill('Test reason');

    // Confirm cancellation
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();

    // Modal should close and booking should refresh (mock returns canceled status)
    await expect(page.getByText('Cancelar sesión')).not.toBeVisible({ timeout: 10_000 });
  });

  test('cancel modal "Volver" closes without canceling', async ({ page }) => {
    await setupBookingMock(page, mockBookingConfirmed);
    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/800');
    await expect(page.getByText('Confirmada')).toBeVisible({ timeout: 10_000 });

    // Open cancel modal
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Cancelar sesión')).toBeVisible();

    // Click "Volver"
    await page.getByRole('button', { name: 'Volver' }).click();

    // Modal should close, booking is still confirmed
    await expect(page.getByText('Cancelar sesión')).not.toBeVisible();
    await expect(page.getByText('Confirmada')).toBeVisible();
  });

  test('reschedule button navigates to /book-session', async ({ page }) => {
    await setupBookingMock(page, mockBookingConfirmed);
    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/800');
    await expect(page.getByText('Confirmada')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Reprogramar' }).click();
    await page.waitForURL('**/book-session');
  });

  test('shows not-found state when booking does not exist', async ({ page }) => {
    await setupBookingMock(page, null);
    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/999');

    await expect(page.getByText('Sesión no encontrada.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Volver al programa')).toBeVisible();
  });

  test('renders canceled booking without action buttons', async ({ page }) => {
    const canceledBooking = {
      ...mockBookingConfirmed,
      status: 'canceled',
      canceled_reason: 'No puedo asistir',
    };
    await setupBookingMock(page, canceledBooking);
    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/800');

    // Status badge — Cancelada
    await expect(page.getByText('Cancelada')).toBeVisible({ timeout: 10_000 });

    // Cancel reason
    await expect(page.getByText('No puedo asistir')).toBeVisible();

    // Action buttons should NOT be visible for canceled bookings
    await expect(page.getByRole('button', { name: 'Reprogramar' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).not.toBeVisible();
  });

  test('renders pending booking with Pendiente badge', async ({ page }) => {
    const pendingBooking = { ...mockBookingConfirmed, status: 'pending' };
    await setupBookingMock(page, pendingBooking);
    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/800');

    await expect(page.getByText('Pendiente')).toBeVisible({ timeout: 10_000 });
  });

  test('shows modification warning when session is within 24h', async ({ page }) => {
    const soonSlotStart = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6h from now
    const soonSlotEnd = new Date(soonSlotStart.getTime() + 60 * 60 * 1000);
    const soonBooking = {
      ...mockBookingConfirmed,
      slot: { ...mockBookingConfirmed.slot, starts_at: soonSlotStart.toISOString(), ends_at: soonSlotEnd.toISOString() },
    };
    await setupBookingMock(page, soonBooking);
    await loginAsTestUser(page);
    await page.goto('/my-sessions/program/11/session/800');

    await expect(page.getByText('Confirmada')).toBeVisible({ timeout: 10_000 });

    // Warning text about 24h modification limit
    await expect(page.getByText(/No se puede modificar a menos de 24h/)).toBeVisible();

    // Buttons should be disabled
    const reprogramarBtn = page.getByRole('button', { name: 'Reprogramar' });
    const cancelarBtn = page.getByRole('button', { name: 'Cancelar' });
    await expect(reprogramarBtn).toBeDisabled();
    await expect(cancelarBtn).toBeDisabled();
  });
});
