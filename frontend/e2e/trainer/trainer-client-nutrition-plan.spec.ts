import type { Page } from '@playwright/test';
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for authoring a weekly nutrition plan from the client-detail
 * "Nutrición" tab (ClientNutritionTab).
 *
 * Contract exercised:
 *   - generate → POST /api/nutrition-plans/generate/
 *   - swap a meal → PATCH /api/nutrition-plans/{id}/days/{d}/meals/{m}/
 *   - publish → POST /api/nutrition-plans/{id}/approve/
 */

const PLAN_ID = 50;
// A day dated "today" (UTC, matching the component's isToday check) so its
// DayCard is expanded by default and the meal row is immediately visible.
const todayISO = new Date().toISOString().slice(0, 10);

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

const draftMeta = {
  id: PLAN_ID, status: 'draft', goal: 'fat_loss', fitness_level: 2,
  week_start: todayISO, week_end: todayISO, trainer_notes: '', approved_at: null, created_at: `${todayISO}T07:00:00Z`,
};

function draftDetail() {
  return {
    ...draftMeta,
    days: [
      {
        id: 100, day_number: 1, week_number: 1, date: todayISO,
        meals: [
          {
            id: 200, meal_block: 'almuerzo', meal_block_label: 'Almuerzo', meal_block_time: '13:00',
            suggestion: { id: 1, title: 'Bowl de quinoa', description: '', calories_estimate: 520, nova_max: 1, goal_tags: [] },
            trainer_notes: '', order: 0,
          },
        ],
      },
    ],
  };
}

async function setupNutriBase(page: Page) {
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
  // fetchClientNutritionLogs (nutri tab effect)
  await page.route('**/api/trainer/my-clients/1/nutrition-logs/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  // HabitSummaryCard (inside ClientNutritionTab) — no habit eval on record
  await page.route('**/api/trainer/my-clients/1/nutrition/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function openNutritionTab(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'María López' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Nutrición' }).click();
}

test.describe('Trainer Client Nutrition Plan', { tag: [...FlowTags.TRAINER_CLIENT_NUTRITION_PLAN, RoleTags.TRAINER] }, () => {

  test('empty state generates a plan → POST /api/nutrition-plans/generate/', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutriBase(page);
    await page.route('**/api/nutrition-plans/customer/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/nutrition-plans/generate/', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(draftDetail()) });
    });
    await page.goto('/trainer/clients/client?id=1');

    await openNutritionTab(page);
    await expect(page.getByRole('button', { name: 'Generar plan de nutrición' })).toBeVisible({ timeout: 10_000 });

    const genReq = page.waitForRequest(
      (r) => r.url().includes('/api/nutrition-plans/generate/') && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Generar plan de nutrición' }).click();
    await genReq;

    // Success UI: the generated draft header renders.
    await expect(page.getByText('Borrador').first()).toBeVisible({ timeout: 10_000 });
  });

  test('swapping a meal → PATCH /api/nutrition-plans/{id}/days/{d}/meals/{m}/', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutriBase(page);
    await page.route('**/api/nutrition-plans/customer/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([draftMeta]) });
    });
    await page.route(`**/api/nutrition-plans/${PLAN_ID}/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(draftDetail()) });
    });
    // Swap picker catalog
    await page.route('**/api/meal-suggestions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [{ id: 99, title: 'Pollo a la plancha', meal_block: 'almuerzo', calories_estimate: 450, nova_max: 2, goal_tags: [], description: '' }] }),
      });
    });
    await page.route('**/api/nutrition-plans/*/days/*/meals/*/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 200, meal_block: 'almuerzo', meal_block_label: 'Almuerzo', meal_block_time: '13:00', suggestion: { id: 99, title: 'Pollo a la plancha', description: '', calories_estimate: 450, nova_max: 2, goal_tags: [] }, trainer_notes: '', order: 0 }),
      });
    });
    await page.goto('/trainer/clients/client?id=1');

    await openNutritionTab(page);
    // Today's DayCard is expanded by default; open the meal swap picker.
    await expect(page.getByText('Bowl de quinoa')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Cambiar' }).first().click();

    const patchReq = page.waitForRequest(
      (r) => /\/api\/nutrition-plans\/\d+\/days\/\d+\/meals\/\d+\//.test(r.url()) && r.method() === 'PATCH',
    );
    await page.getByRole('button', { name: /Pollo a la plancha/ }).click();
    await patchReq;
  });

  test('publishing a draft → POST /api/nutrition-plans/{id}/approve/', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupNutriBase(page);
    await page.route('**/api/nutrition-plans/customer/1/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([draftMeta]) });
    });
    await page.route(`**/api/nutrition-plans/${PLAN_ID}/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(draftDetail()) });
    });
    await page.route(`**/api/nutrition-plans/${PLAN_ID}/approve/`, async (route) => {
      const published = { ...draftDetail(), status: 'published', approved_at: new Date().toISOString() };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(published) });
    });
    await page.goto('/trainer/clients/client?id=1');

    await openNutritionTab(page);
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible({ timeout: 10_000 });

    const approveReq = page.waitForRequest(
      (r) => /\/api\/nutrition-plans\/\d+\/approve\//.test(r.url()) && r.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Publicar' }).click();
    await approveReq;

    // Success UI: the plan header now shows the Published badge.
    await expect(page.getByText('Publicado').first()).toBeVisible({ timeout: 10_000 });
  });
});
