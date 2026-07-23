import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { mockApiError } from '../helpers/api-errors';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const PENDING_CREDITS = {
  count: 1,
  results: [
    {
      id: 42,
      action: 'workout_day',
      amount: 10,
      status: 'pending',
      description: 'Completaste tu entrenamiento',
      reference_type: 'daily_log',
      reference_id: '5',
      review_deadline: null,
      created_at: '2026-07-10T10:00:00Z',
      customer_email: 'cliente@test.com',
      customer_name: 'Cliente Uno',
      photos: ['/media/workout_captures/2026/07/cap.jpg'],
      photo_url: '/media/workout_captures/2026/07/cap.jpg',
    },
  ],
};

test.describe('Trainer — tareas pendientes', { tag: [...FlowTags.TRAINER_TASKS, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await page.route('**/api/trainer/store/redemptions/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }),
    );
  });

  test('shows a pending credit with photo and approves it', async ({ page }) => {
    await page.route('**/api/trainer/credits/pending-reviews/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING_CREDITS) }),
    );
    await page.route('**/api/trainer/credits/transactions/42/review/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 42, status: 'confirmed' }) }),
    );

    await page.goto('/trainer/tareas');
    await expect(page.getByTestId('trainer-tareas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Cliente Uno')).toBeVisible();
    await expect(page.getByText('Entrenamiento · +10 créditos')).toBeVisible();

    await page.getByRole('button', { name: 'Aprobar' }).first().click();
    await expect(page.getByText('Cliente Uno')).not.toBeVisible();
  });

  test('rejects a pending credit with a note', async ({ page }) => {
    await page.route('**/api/trainer/credits/pending-reviews/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING_CREDITS) }),
    );
    await page.route('**/api/trainer/credits/transactions/42/review/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 42, status: 'rejected' }) }),
    );

    await page.goto('/trainer/tareas');
    await expect(page.getByTestId('trainer-tareas')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Rechazar' }).first().click();
    await page.getByTestId('reject-note-42').fill('Foto no válida');
    await page.getByRole('button', { name: 'Confirmar rechazo' }).click();
    await expect(page.getByText('Cliente Uno')).not.toBeVisible();
  });

  test('delivers a pending redemption from the canjes tab', async ({ page }) => {
    await page.route('**/api/trainer/credits/pending-reviews/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }),
    );
    await page.route('**/api/trainer/store/redemptions/', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          results: [
            {
              id: 55,
              item: 7,
              item_name: 'Descuento próximo plan',
              item_type: 'descuento',
              item_image_url: null,
              credits_spent: 40,
              status: 'pending',
              trainer_note: '',
              delivery_photo_url: null,
              created_at: '2026-07-18T09:00:00Z',
              resolved_at: null,
              customer_email: 'cliente@test.com',
              customer_name: 'Cliente Uno',
            },
          ],
        }),
      }),
    );
    await page.route('**/api/trainer/store/redemptions/55/review/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 55, status: 'fulfilled' }) }),
    );

    await page.goto('/trainer/tareas');
    await expect(page.getByTestId('trainer-tareas')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Canjes (1)' }).click();
    await expect(page.getByText('Descuento próximo plan')).toBeVisible();

    await page.getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByTestId('deliver-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();

    await expect(page.getByText('No hay canjes pendientes.')).toBeVisible();
  });

  test('degrades to an empty credit list when reviews fail to load', async ({ page }) => {
    await mockApiError(page, '**/api/trainer/credits/pending-reviews/', 500);

    await page.goto('/trainer/tareas');

    // The page has no visible error UI for this failure: the store records the
    // error but the view degrades to the empty-list copy with a zero counter.
    await expect(page.getByRole('heading', { name: 'Tareas pendientes' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Créditos (0)' })).toBeVisible();
    await expect(page.getByText('No hay créditos por revisar.')).toBeVisible();
  });

  test('shows empty messages on both tabs when nothing is pending', async ({ page }) => {
    await page.route('**/api/trainer/credits/pending-reviews/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }),
    );

    await page.goto('/trainer/tareas');

    await expect(page.getByText('No hay créditos por revisar.')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Canjes (0)' }).click();
    await expect(page.getByText('No hay canjes pendientes.')).toBeVisible();
  });
});
