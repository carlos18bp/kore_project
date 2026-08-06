import { test, expect, E2E_USER, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the customer's trainer-message overlay on /dashboard.
 *
 * The layout mounts TrainerMessageModal (app/(app)/layout.tsx), a full-screen
 * overlay that — once the profile is loaded and the mood is handled — polls
 * GET /my-trainer-messages/ after a 1500ms delay and renders any messages.
 * The response shape is { messages: [{ id, trigger_type, message, created_at,
 * trainer_name }] } (see TrainerMessageModal.tsx). Dismiss hits
 * POST /my-trainer-messages/{id}/dismiss/.
 *
 * NOTE: /dashboard ALSO mounts TrainerMessageBanner (a corner card) which
 * consumes the same endpoint and renders the same message text. We use a
 * `post_session` trigger so the modal-only header "Mensaje de tu entrenador"
 * and the "Entendido" CTA uniquely identify the overlay (the banner shows
 * "Después de tu sesión" for that trigger), and we scope message-text asserts
 * to the modal's `div.fixed.inset-0` container.
 */
test.describe('Customer trainer message overlay (mocked)', { tag: [...FlowTags.CUSTOMER_TRAINER_MESSAGE, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const trainerMsg = {
    id: 77,
    trigger_type: 'post_session',
    message: 'Excelente trabajo en tu última sesión. Enfócate en la hidratación esta semana.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    trainer_name: 'Germán Franco',
  };

  async function setupTrainerMessages(
    page: import('@playwright/test').Page,
    messages: Array<Record<string, unknown>>,
  ) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page);
    // POST dismiss — more specific, registered after the list route (LIFO priority).
    await page.route('**/api/my-trainer-messages/*/dismiss/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: 'ok' }) });
    });
    // GET list — the exact endpoint the modal (and banner) poll.
    await page.route('**/api/my-trainer-messages/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages }) });
    });
  }

  // The full-screen overlay (layout's TrainerMessageModal), distinct from the
  // dashboard's corner banner. Uniquely identified by its "Entendido" CTA.
  const modalLocator = (page: import('@playwright/test').Page) =>
    page.locator('div.fixed.inset-0', { hasText: 'Entendido' });

  test('shows the trainer message overlay with the message content', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista; no hay acción previa que ejecutar)
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await setupTrainerMessages(page, [trainerMsg]);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { level: 1, name: new RegExp(E2E_USER.firstName) })).toBeVisible({ timeout: 10_000 });

    const modal = modalLocator(page);
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText('Mensaje de tu entrenador')).toBeVisible();
    await expect(modal.getByText(trainerMsg.message)).toBeVisible();
    await expect(modal.getByText('Germán Franco')).toBeVisible();
    await expect(modal.getByText('1 mensaje nuevo')).toBeVisible();
  });

  test('dismissing the message fires POST dismiss and closes the overlay', async ({ page }) => {
    await setupTrainerMessages(page, [trainerMsg]);
    await page.goto('/dashboard');

    const modal = modalLocator(page);
    await expect(modal).toBeVisible({ timeout: 15_000 });

    const dismissRequest = page.waitForRequest(
      (r) => r.url().includes('/my-trainer-messages/77/dismiss/') && r.method() === 'POST',
    );
    await modal.getByRole('button', { name: 'Marcar como leído' }).click();
    await dismissRequest;

    // "Entendido" is unique to the modal — its disappearance confirms the overlay closed.
    await expect(page.getByRole('button', { name: 'Entendido' })).not.toBeVisible();
  });

  test('shows no trainer message overlay when there are no messages', async ({ page }) => {
    await setupTrainerMessages(page, []);
    // Register the poll listener before navigating so the modal's delayed
    // (1500ms) fetch is captured whenever it fires — deterministic, no sleep.
    const messagesPoll = page.waitForResponse(
      (r) => r.url().includes('/api/my-trainer-messages/') && r.request().method() === 'GET',
    );
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { level: 1, name: new RegExp(E2E_USER.firstName) })).toBeVisible({ timeout: 10_000 });
    await messagesPoll;
    await expect(page.getByRole('button', { name: 'Entendido' })).not.toBeVisible();
    await expect(page.getByText(trainerMsg.message)).not.toBeVisible();
  });
});
