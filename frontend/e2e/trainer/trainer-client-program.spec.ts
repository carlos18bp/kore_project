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
