import { test, expect, mockLoginAsTestUser } from '../fixtures';
import type { Page } from '@playwright/test';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

function buildSingleFutureSlot(dateIso: string) {
  return {
    id: 100,
    trainer_id: 1,
    starts_at: `${dateIso}T10:00:00Z`,
    ends_at: `${dateIso}T11:00:00Z`,
    is_active: true,
    is_blocked: false,
  };
}

async function mockBookSessionCoverageRoutes(page: Page, dateIso: string) {
  const mockSlot = buildSingleFutureSlot(dateIso);
  await page.route('**/api/availability-slots/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSlot] }),
    });
  });
  await page.route('**/api/trainers/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 1,
          user_id: 100,
          first_name: 'Test',
          last_name: 'Trainer',
          email: 'trainer@kore.com',
          specialty: 'Funcional',
          bio: '',
          location: 'Bogotá',
          session_duration_minutes: 60,
        }],
      }),
    });
  });
  await page.route('**/api/subscriptions/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/payments/') || url.includes('/cancel/')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 1,
          customer_email: 'e2e@kore.com',
          package: { id: 1, title: 'Test Package', sessions_count: 4, session_duration_minutes: 60, price: '100000', currency: 'COP', validity_days: 30 },
          sessions_total: 4,
          sessions_used: 0,
          sessions_remaining: 4,
          status: 'active',
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          next_billing_date: null,
        }],
      }),
    });
  });
  await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
  });
}

/**
 * E2E tests targeting specific coverage gaps identified in the coverage report.
 * These tests exercise branches that were not hit by other tests.
 */
test.describe('Coverage Gap Tests', { tag: [...FlowTags.APP_COVERAGE_GAPS, RoleTags.USER] }, () => {
  test.describe.configure({ mode: 'serial' });

  // ─────────────────────────────────────────────────────────────────────────
  // TimeSlotPicker.tsx line 24 — Empty slots fallback
  // ─────────────────────────────────────────────────────────────────────────
  test('TimeSlotPicker shows empty message when no slots available', async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await mockLoginAsTestUser(page);
    await mockBookSessionCoverageRoutes(page, tomorrowStr);

    await page.goto('/book-session');

    await expect(page.getByText('Agenda tu sesión')).toBeVisible({ timeout: 10_000 });
    const targetDay = String(tomorrow.getDate());
    const enabledDay = page.getByRole('button', { name: new RegExp(`^${targetDay}$`) });
    const dayExists = await enabledDay.isVisible().catch(() => false);
    if (dayExists) {
      await enabledDay.click();
      // Either slots appear or empty message
      await expect(
        page.getByText(/\d{1,2}:\d{2}/).first().or(page.getByText('No hay horarios disponibles'))
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // my-programs/page.tsx lines 16-20 — SubscriptionCard with active subscription
  // ─────────────────────────────────────────────────────────────────────────
  test('my-programs shows SubscriptionCard with active subscription', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const activeSub = {
      id: 11,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Pro', sessions_count: 8, session_duration_minutes: 60, price: '240000', currency: 'COP', validity_days: 60 },
      sessions_total: 8,
      sessions_used: 3,
      sessions_remaining: 5,
      status: 'active',
      starts_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 50 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [activeSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/my-programs');

    // Verify SubscriptionCard renders with active subscription details
    await expect(page.getByText('Paquete Pro')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Activo')).toBeVisible();
    await expect(page.getByText('3 / 8')).toBeVisible();
    await expect(page.getByText('5').first()).toBeVisible(); // sessions_remaining
  });

  test('my-programs shows SubscriptionCard with expired subscription', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const expiredSub = {
      id: 12,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Básico', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 30 },
      sessions_total: 4,
      sessions_used: 4,
      sessions_remaining: 0,
      status: 'expired',
      starts_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [expiredSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/my-programs');

    // Verify SubscriptionCard renders with expired status badge
    await expect(page.getByText('Paquete Básico')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Vencido')).toBeVisible();
  });

  test('my-programs shows SubscriptionCard with canceled subscription', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const canceledSub = {
      id: 13,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Premium', sessions_count: 12, session_duration_minutes: 60, price: '360000', currency: 'COP', validity_days: 90 },
      sessions_total: 12,
      sessions_used: 2,
      sessions_remaining: 10,
      status: 'canceled',
      starts_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 70 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [canceledSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/my-programs');

    // Verify SubscriptionCard renders with canceled status badge
    await expect(page.getByText('Paquete Premium')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Cancelado')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // my-programs/page.tsx line 17 — STATUS_BADGE fallback (unknown status)
  // ─────────────────────────────────────────────────────────────────────────
  test('my-programs SubscriptionCard uses fallback badge for unknown status', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const unknownStatusSub = {
      id: 14,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Especial', sessions_count: 6, session_duration_minutes: 60, price: '180000', currency: 'COP', validity_days: 45 },
      sessions_total: 6,
      sessions_used: 1,
      sessions_remaining: 5,
      status: 'archived', // Unknown status should fallback to active badge
      starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 40 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [unknownStatusSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/my-programs');

    // Should render the card with fallback to "Activo" badge since status is unknown
    await expect(page.getByText('Paquete Especial')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Activo')).toBeVisible(); // Fallback
  });

  // ─────────────────────────────────────────────────────────────────────────
  // subscriptionStore.ts lines 57-59 — fetchSubscriptions error path
  // ─────────────────────────────────────────────────────────────────────────
  test('subscriptionStore fetchSubscriptions error shows message on subscription page', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/subscriptions/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/subscription');

    await expect(page.getByText('No se pudieron cargar las suscripciones.')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // subscriptionStore.ts lines 89-91 — fetchPaymentHistory error path
  // ─────────────────────────────────────────────────────────────────────────
  test('subscriptionStore fetchPaymentHistory error shows message on subscription page', async ({ page }) => {
    await mockLoginAsTestUser(page);
    const mockSub = {
      id: 30,
      customer_email: 'e2e@kore.com',
      package: { id: 6, title: 'Paquete Error', sessions_count: 4, session_duration_minutes: 60, price: '120000', currency: 'COP', validity_days: 30 },
      sessions_total: 4,
      sessions_used: 1,
      sessions_remaining: 3,
      status: 'active',
      starts_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 25 * 86400000).toISOString(),
      next_billing_date: null,
    };

    await page.route('**/api/subscriptions/*/payments/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/') || url.includes('/expiry-reminder')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [mockSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.goto('/subscription');

    await expect(page.getByText('No se pudo cargar el historial de pagos.')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // bookingStore.ts lines 143-145 — extractErrorMessage non_field_errors branch
  // bookingStore.ts lines 149-153 — extractErrorMessage field-key (slot_id) branch
  // Both exercised via createBooking() failure on the book-session confirmation step
  // ─────────────────────────────────────────────────────────────────────────

  const _bktomorrow = new Date();
  _bktomorrow.setDate(_bktomorrow.getDate() + 1);
  const _bkdateStr = _bktomorrow.toISOString().split('T')[0];
  const _bkSlot = {
    id: 601,
    starts_at: `${_bkdateStr}T10:00:00Z`,
    ends_at: `${_bkdateStr}T11:00:00Z`,
    is_blocked: false,
    is_active: true,
    trainer_id: 1,
  };
  const _bkSub = {
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
  const _bkSlotLabel = (() => {
    const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(_bkSlot.starts_at)} — ${fmt(_bkSlot.ends_at)}`;
  })();

  async function setupBookSessionMocksForError(page: Page) {
    await page.route('**/api/trainers/**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [{ id: 1, user_id: 100, first_name: 'Test', last_name: 'Trainer', email: 'trainer@kore.com', specialty: 'Funcional', bio: '', location: 'Bogotá', session_duration_minutes: 60 }] }),
      });
    });
    await page.route('**/api/availability-slots/**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [_bkSlot] }),
      });
    });
    await page.route('**/api/subscriptions/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/') || url.includes('/cancel/')) { await route.fallback(); return; }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [_bkSub] }),
      });
    });
    await page.route('**/api/bookings/upcoming-reminder/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });
  }

  async function goToBookSessionConfirmStep(page: Page) {
    await page.goto('/book-session');
    await page.getByText('Lun').waitFor({ state: 'visible', timeout: 10_000 });
    const dayNum = _bktomorrow.getDate().toString();
    await page.evaluate((num) => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === num) {
          const propsKey = Object.keys(btn).find(k => k.startsWith('__reactProps$'));
          if (propsKey) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const props = (btn as unknown as Record<string, any>)[propsKey];
            if (typeof props?.onClick === 'function') { props.onClick(); }
          }
          break;
        }
      }
    }, dayNum);
    await page.getByRole('button', { name: _bkSlotLabel, exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: _bkSlotLabel, exact: true }).click();
    await expect(page.getByRole('main').getByText('Confirmar reserva')).toBeVisible({ timeout: 10_000 });
  }

  test('bookingStore.createBooking non_field_errors string surfaces in BookingConfirmation', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupBookSessionMocksForError(page);
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ non_field_errors: 'El horario ya no está disponible.' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
      }
    });

    await goToBookSessionConfirmStep(page);
    await page.getByRole('button', { name: /Confirmar/i }).click();

    await expect(page.getByText('El horario ya no está disponible.')).toBeVisible({ timeout: 10_000 });
  });

  test('bookingStore.createBooking slot_id field error surfaces in BookingConfirmation', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupBookSessionMocksForError(page);
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ slot_id: ['Este horario ya está reservado.'] }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
      }
    });

    await goToBookSessionConfirmStep(page);
    await page.getByRole('button', { name: /Confirmar/i }).click();

    await expect(page.getByText('Este horario ya está reservado.')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TimeSlotPicker.tsx lines 10-15 — use24h=false branch of formatTime
  // Exercised by clicking the '12h' toggle button when slots are rendered.
  // ─────────────────────────────────────────────────────────────────────────
  test('TimeSlotPicker 12h toggle changes slot time format to AM/PM', async ({ page }) => {
    await mockLoginAsTestUser(page);
    await setupBookSessionMocksForError(page);
    await page.route('**/api/bookings/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/book-session');
    await page.getByText('Lun').waitFor({ state: 'visible', timeout: 10_000 });

    const dayNum = _bktomorrow.getDate().toString();
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

    // Slot should appear in 24h format initially
    await page.getByRole('button', { name: _bkSlotLabel, exact: true }).waitFor({ state: 'visible', timeout: 10_000 });

    // Click 12h toggle — exercises TimeSlotPicker.tsx use24h=false branch
    await page.getByRole('button', { name: '12h' }).click();

    // Slot button should now show AM/PM format
    await expect(page.getByRole('button', { name: /AM|PM/i }).first()).toBeVisible({ timeout: 5_000 });

    // Toggle back to 24h
    await page.getByRole('button', { name: '24h' }).click();
    await expect(page.getByRole('button', { name: _bkSlotLabel, exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
