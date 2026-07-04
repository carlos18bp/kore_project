import type { Page } from '@playwright/test';
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the trainer → client messaging contract on the client-detail
 * page (POST /api/trainer/messages/).
 *
 * NOTE ON SURFACE: The task referenced PostSessionMessageSheet, but that sheet
 * has no clickable trigger wired into the current client-detail page — its
 * open state (`postSessionSheet`) is only set via `onMessage` on a SessionRow,
 * and the Resumen tab renders SessionRow WITHOUT passing `onMessage`. The
 * reachable messaging surface is the "Notas" tab → "Sesiones" sub-tab →
 * MessageComposerCard, which posts to the same POST /api/trainer/messages/
 * endpoint (via trainerStore.sendTrainerMessage). These tests exercise that
 * real, clickable flow.
 */

const fakeClient = {
  id: 1,
  first_name: 'María',
  last_name: 'López',
  email: 'maria@example.com',
  phone: '3009876543',
  avatar_url: null,
  profile: { sex: 'femenino', date_of_birth: '1992-03-20', city: 'Medellín', primary_goal: 'fat_loss' },
  subscription: {
    id: 11, package_id: 6, package_title: 'Plan Elite', package_price: '300000', package_currency: 'COP',
    sessions_total: 10, sessions_used: 4, sessions_remaining: 6,
    starts_at: '2025-10-01', expires_at: '2026-01-01', next_billing_date: null, is_recurring: false, status: 'active',
  },
  last_payment: { amount: '300000', currency: 'COP', created_at: '2025-10-01' },
  next_session: null,
  stats: { completed: 4, pending: 2, canceled: 1, total: 7 },
};

const COMPOSER_PLACEHOLDER = 'Escribe un mensaje para este cliente...';

async function setupClientMocks(page: Page) {
  await page.route('**/api/trainer/dashboard-stats/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_clients: 1, today_sessions: 0, upcoming_sessions: [] }) });
  });
  await page.route('**/api/trainer/my-clients/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/trainer/my-clients/1/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeClient) });
  });
  await page.route('**/api/trainer/my-clients/1/sessions/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/trainer/my-clients/1/sessions-full/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/trainer/my-clients/1/kpi/', async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
  await page.route('**/api/trainer/my-clients/1/alerts/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Trainer Client Messaging', { tag: [...FlowTags.TRAINER_CLIENT_MESSAGING, RoleTags.TRAINER] }, () => {

  test('Notas tab renders the message composer', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientMocks(page);
    await page.route('**/api/trainer/messages/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) });
    });
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Notas' }).click();

    await expect(page.getByPlaceholder(COMPOSER_PLACEHOLDER)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeVisible();
  });

  test('composing + sending fires POST /api/trainer/messages/ and clears the composer', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientMocks(page);
    // Register the general list route FIRST and the specific POST route LAST:
    // routes are LIFO, so the specific route (matched only by the query-less
    // POST URL) is checked before the general list route.
    await page.route('**/api/trainer/messages/**', async (route) => {
      // GET list (initial + post-send refetch)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) });
    });
    await page.route('**/api/trainer/messages/', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 900, message: '¡Buen trabajo hoy!', trigger_type: 'manual', seen_by_customer: false, created_at: new Date().toISOString() }) });
      } else {
        await route.continue();
      }
    });
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Notas' }).click();

    const composer = page.getByPlaceholder(COMPOSER_PLACEHOLDER);
    await expect(composer).toBeVisible({ timeout: 10_000 });
    await composer.fill('¡Buen trabajo hoy!');

    const messageReq = page.waitForRequest(
      (r) => r.url().includes('/api/trainer/messages/') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    const req = await messageReq;

    // Contract: body carries the customer + message + trigger type.
    const body = req.postDataJSON();
    expect(body.customer_id).toBe(1);
    expect(body.message).toBe('¡Buen trabajo hoy!');
    expect(body.trigger_type).toBe('manual');

    // Success UI: the composer resets to empty after a successful send.
    await expect(composer).toHaveValue('');
  });

  test('sent message appears in the client message history after refetch', async ({ page }) => {
    const sentText = 'Recuerda hidratarte bien mañana.';
    const sentMessage = { id: 901, message: sentText, trigger_type: 'manual', seen_by_customer: false, created_at: new Date().toISOString() };
    let posted = false;

    await injectTrainerAuthCookies(page);
    await setupClientMocks(page);
    // General list route FIRST, specific POST route LAST (LIFO — see test above).
    await page.route('**/api/trainer/messages/**', async (route) => {
      // GET list — returns the new message only after it has been POSTed.
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: posted ? [sentMessage] : [] }) });
    });
    await page.route('**/api/trainer/messages/', async (route) => {
      if (route.request().method() === 'POST') {
        posted = true;
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(sentMessage) });
      } else {
        await route.continue();
      }
    });
    await page.goto('/trainer/clients/client?id=1');

    await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Notas' }).click();

    const composer = page.getByPlaceholder(COMPOSER_PLACEHOLDER);
    await expect(composer).toBeVisible({ timeout: 10_000 });
    await composer.fill(sentText);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByText(sentText)).toBeVisible({ timeout: 10_000 });
  });
});
