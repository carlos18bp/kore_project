import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the customer weekly nutrition plan surface on /my-nutrition.
 *
 * The weekly plan the customer sees is the trainer's approved plan note, fetched
 * by `useNutritionStore.fetchMyWeeklyPlans` from GET /api/my-nutrition-plans/
 * (plural — there is no /my-nutrition-plan/ singular endpoint in the app). It is
 * rendered inside the collapsible "Nota de tu coach" strip on the daily hero, so
 * these tests also mock GET /api/my-nutrition-daily/today/ to make the hero (and
 * therefore the coach note) render.
 */
test.describe('Customer Nutrition Plan', { tag: [...FlowTags.CUSTOMER_NUTRITION_PLAN, RoleTags.USER] }, () => {

  const today = new Date().toISOString().slice(0, 10);

  const todayLog = {
    id: 1,
    date: today,
    is_closed: false,
    closed_at: null,
    notes: '',
    program_goal: 'general_health',
    trainer_nutrition_note: null as string | null,
    water_glasses: [] as { id: number; photo_url: string | null; created_at: string }[],
    meal_entries: [
      {
        id: 11,
        meal_block: 'desayuno',
        status: 'not_done' as const,
        notes: '',
        photo_url: null as string | null,
        suggestion: {
          id: 101,
          title: 'Avena con frutas',
          description: 'Avena cocida con banano y arándanos',
          calories_estimate: 420,
          meal_block: 'desayuno',
          foods: [],
        },
      },
    ],
  };

  const weeklyPlan = {
    id: 1,
    status: 'approved',
    week_start: '2026-06-29',
    week_end: '2026-07-05',
    trainer_notes: 'Prioriza proteína magra y verduras en el almuerzo esta semana.',
    approved_at: '2026-06-30T09:00:00Z',
    created_at: '2026-06-29T08:00:00Z',
    goal: 'general_health',
  };

  async function mockPlan(
    page: import('@playwright/test').Page,
    opts: { daily?: typeof todayLog | null; plans?: typeof weeklyPlan[] } = {},
  ) {
    await injectAuthCookies(page);
    // setupDefaultApiMocks provides GET /my-nutrition/ -> [] (no habits block).
    await setupDefaultApiMocks(page);
    await page.route('**/api/nutrition/access/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ has_nutrition_access: true, price_cop: 30000 }) }));
    await page.route('**/api/my-nutrition-plans/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(opts.plans ?? []),
      });
    });
    await page.route('**/api/my-nutrition-daily/today/', async (route) => {
      if (opts.daily === undefined || opts.daily === null) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'No active program' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.daily) });
      }
    });
  }

  async function goToNutrition(page: import('@playwright/test').Page) {
    await page.goto('/my-nutrition');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  }

  test('shows the coach-note toggle when a weekly plan note exists', async ({ page }) => {
    await mockPlan(page, { daily: todayLog, plans: [weeklyPlan] });
    await goToNutrition(page);

    await expect(page.getByRole('button', { name: /Nota de tu coach/ })).toBeVisible();
  });

  test('expanding the coach note reveals the weekly plan text', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-deep-link (el área autenticada exige sesión inyectada por cookie; no hay ruta de UI pública hasta esta vista)
    await mockPlan(page, { daily: todayLog, plans: [weeklyPlan] });
    await goToNutrition(page);

    await page.getByRole('button', { name: /Nota de tu coach/ }).click();

    await expect(page.getByText(/Plan nutricional/)).toBeVisible();
    await expect(page.getByText(/Prioriza proteína magra y verduras/)).toBeVisible();
  });

  test('renders the plan-derived meal for the day', async ({ page }) => {
    await mockPlan(page, { daily: todayLog, plans: [weeklyPlan] });
    await goToNutrition(page);

    // The active plan hydrates the daily timeline; the meal suggestion is visible.
    await expect(page.getByText('Tu día · timeline')).toBeVisible();
    await expect(page.getByText('Avena con frutas')).toBeVisible();
  });

  test('shows the "Sin plan activo" empty state when there is no active plan', async ({ page }) => {
    await mockPlan(page, { daily: null, plans: [] });
    await goToNutrition(page);

    await expect(page.getByRole('heading', { name: 'Sin plan activo' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ver mi programa/ })).toBeVisible();
    // With no plan there is no coach note to expand.
    await expect(page.getByRole('button', { name: /Nota de tu coach/ })).not.toBeVisible();
  });
});
