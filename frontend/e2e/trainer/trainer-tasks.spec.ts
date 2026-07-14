import { test, expect, injectTrainerAuthCookies } from '../fixtures';
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
});
