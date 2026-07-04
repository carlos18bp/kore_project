import type { Page } from '@playwright/test';
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeClient = {
  id: 1, first_name: 'María', last_name: 'López', email: 'maria@example.com',
  primary_goal: 'fat_loss', active_package: 'Plan Elite',
  sessions_remaining: 4, total_sessions: 10, completed_sessions: 6,
  last_session_date: '2026-05-13',
};

const fakeProgram = {
  id: 10, customer_id: 1, fitness_level: 2, goal: 'fat_loss',
  start_date: '2026-05-01', end_date: '2026-05-28', status: 'published',
  trainer_notes: 'Buen progreso esta semana.', approved_at: '2026-05-01T08:00:00Z',
  created_at: '2026-05-01T07:00:00Z', booking_dates: [],
  days: [
    { id: 100, day_number: 1, date: '2026-05-01', day_type: 'training', exercises: [] },
    { id: 101, day_number: 2, date: '2026-05-02', day_type: 'active_rest', exercises: [] },
  ],
};

async function setupClientProgramMocks(page: Page) {
  await page.route('**/api/trainer/my-clients/1/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeClient) });
  });
  await page.route('**/api/monthly-programs/customer/1/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeProgram]) });
  });
  await page.route('**/api/trainer/dashboard-stats/', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total_clients: 3, today_sessions: 1, upcoming_sessions: [] }),
    });
  });
  await page.route('**/api/trainer/my-clients/1/kpi/', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
  });
  await page.route('**/api/trainer/my-clients/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeClient]) });
  });
  await page.route('**/api/trainer/my-clients/1/daily-logs/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/exercises/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], count: 0 }) });
  });
  await page.route('**/api/monthly-programs/*/fitness-level/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fitness_level_computed: 2, fitness_level_override: null }) });
  });
}

test.describe('Trainer Client Program Tab', { tag: [...FlowTags.TRAINER_CLIENT_PROGRAM, RoleTags.TRAINER] }, () => {
  test('page loads with Programa mensual heading', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientProgramMocks(page);
    await page.goto('/trainer/clients/client/programa?id=1');

    await expect(page.getByRole('heading', { name: 'Programa mensual' })).toBeVisible({ timeout: 15_000 });
  });

  test('back link to client detail is present', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientProgramMocks(page);
    await page.goto('/trainer/clients/client/programa?id=1');

    const backLink = page.getByRole('link', { name: 'Volver al cliente' });
    await expect(backLink).toBeVisible({ timeout: 10_000 });
    const href = await backLink.getAttribute('href');
    expect(href).toContain('/trainer/clients/client?id=1');
  });

  test('program day entries render with day type chips', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupClientProgramMocks(page);
    await page.goto('/trainer/clients/client/programa?id=1');

    await expect(page.getByText('Entrenamiento').first()).toBeVisible({ timeout: 10_000 });
  });

  test('no client id shows error message', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await page.goto('/trainer/clients/client/programa');

    await expect(page.getByText('Cliente no especificado.')).toBeVisible({ timeout: 10_000 });
  });

  test('empty state shown when client has no program', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await page.route('**/api/trainer/my-clients/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeClient) });
    });
    await page.route('**/api/monthly-programs/customer/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_clients: 1, today_sessions: 0, upcoming_sessions: [] }) });
    });
    await page.route('**/api/trainer/my-clients/1/kpi/', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
    });
    await page.route('**/api/trainer/my-clients/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeClient]) });
    });
    await page.route('**/api/trainer/my-clients/1/daily-logs/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/exercises/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], count: 0 }) });
    });
    await page.goto('/trainer/clients/client/programa?id=1');

    await expect(page.getByText('Sin programa mensual')).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Authoring flow (generate / edit exercise / publish) ────────────────────
const draftProgramWithExercise = {
  id: 20, customer_id: 1, fitness_level: 2, goal: 'fat_loss',
  start_date: '2026-07-01', end_date: '2026-07-28', status: 'draft',
  trainer_notes: '', current_week_note: null, approved_at: null,
  created_at: '2026-07-01T07:00:00Z', booking_dates: [],
  days: [
    {
      id: 300, day_number: 1, date: '2026-07-01', day_type: 'training',
      exercises: [
        {
          id: 400,
          exercise: { id: 5, name: 'Sentadilla', pattern: 'squat', youtube_url: '', explanation: '', is_corrective: false, primary_muscles: 'cuádriceps', secondary_muscles: '' },
          sets: 3, reps: 10, duration_seconds: null, rest_seconds: 60, order: 0, notes: '',
        },
      ],
    },
  ],
};

const draftProgramForPublish = {
  id: 21, customer_id: 1, fitness_level: 2, goal: 'muscle_gain',
  start_date: '2026-07-01', end_date: '2026-07-28', status: 'draft',
  trainer_notes: '', current_week_note: null, approved_at: null,
  created_at: '2026-07-01T07:00:00Z', booking_dates: [],
  days: [
    { id: 310, day_number: 1, date: '2026-07-01', day_type: 'training', exercises: [] },
  ],
};

// Peripheral endpoints ClientProgramTab / trainer layout touch, minus the
// monthly-programs routes (each authoring test registers those itself).
async function setupProgramPeripherals(page: Page) {
  await page.route('**/api/trainer/dashboard-stats/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_clients: 1, today_sessions: 0, upcoming_sessions: [] }) });
  });
  await page.route('**/api/trainer/my-clients/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeClient]) });
  });
  await page.route('**/api/trainer/my-clients/1/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeClient) });
  });
  await page.route('**/api/trainer/my-clients/1/fitness-level/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fitness_level_computed: 2, fitness_level_override: null }) });
  });
  await page.route('**/api/trainer/my-clients/1/daily-logs/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/exercises/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], count: 0 }) });
  });
}

test.describe('Trainer Client Program Tab — Authoring', { tag: [...FlowTags.TRAINER_CLIENT_PROGRAM, RoleTags.TRAINER] }, () => {

  test('empty state generates a program → POST /api/monthly-programs/generate/', async ({ page }) => {
    let generated = false;
    await injectTrainerAuthCookies(page);
    await setupProgramPeripherals(page);
    await page.route('**/api/monthly-programs/customer/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(generated ? [draftProgramForPublish] : []) });
    });
    await page.route('**/api/monthly-programs/generate/', async (route) => {
      generated = true;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(draftProgramForPublish) });
    });
    await page.goto('/trainer/clients/client/programa?id=1');

    await expect(page.getByRole('button', { name: 'Generar programa' })).toBeVisible({ timeout: 15_000 });

    const genReq = page.waitForRequest(
      (r) => r.url().includes('/api/monthly-programs/generate/') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Generar programa' }).click();
    await genReq;

    // Success UI: the generated draft header renders.
    await expect(page.getByText('Borrador').first()).toBeVisible({ timeout: 10_000 });
  });

  test('editing an exercise → PATCH /api/monthly-programs/{id}/days/{d}/exercises/{e}/', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupProgramPeripherals(page);
    await page.route('**/api/monthly-programs/customer/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([draftProgramWithExercise]) });
    });
    await page.route('**/api/monthly-programs/*/days/*/exercises/*/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...draftProgramWithExercise.days[0].exercises[0], sets: 4 }),
      });
    });
    await page.goto('/trainer/clients/client/programa?id=1');

    // Week 1 is expanded by default; open the training day to reveal exercises.
    await expect(page.getByText('1 ejercicios')).toBeVisible({ timeout: 15_000 });
    await page.getByText('1 ejercicios').click();

    await expect(page.getByText('Sentadilla')).toBeVisible({ timeout: 10_000 });
    await page.getByTitle('Editar ejercicio').click();

    const patchReq = page.waitForRequest(
      (r) => /\/api\/monthly-programs\/\d+\/days\/\d+\/exercises\/\d+\//.test(r.url()) && r.method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Guardar' }).click();
    await patchReq;
  });

  test('publishing a draft program → PATCH /api/monthly-programs/{id}/approve/', async ({ page }) => {
    let approved = false;
    await injectTrainerAuthCookies(page);
    await setupProgramPeripherals(page);
    await page.route('**/api/monthly-programs/customer/1/', async (route) => {
      const published = { ...draftProgramForPublish, status: 'published', approved_at: new Date().toISOString() };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(approved ? [published] : [draftProgramForPublish]) });
    });
    await page.route('**/api/monthly-programs/*/approve/', async (route) => {
      approved = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/trainer/clients/client/programa?id=1');

    await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible({ timeout: 15_000 });

    const approveReq = page.waitForRequest(
      (r) => /\/api\/monthly-programs\/\d+\/approve\//.test(r.url()) && r.method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Publicar' }).click();
    await approveReq;

    // Success UI: the header flips to the Published badge after refetch.
    await expect(page.getByText('Publicado').first()).toBeVisible({ timeout: 10_000 });
  });
});
