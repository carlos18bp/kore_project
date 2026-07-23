import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the redesigned Customer Nutrition page (/my-nutrition).
 * The page is now a daily nutrition tracker: a "today" hero (calorie ring + macros),
 * a meal timeline, a hydration tracker, plus a weekly-habits score block (only shown
 * once the trainer has approved the latest habits entry).
 */
test.describe('Customer Nutrition Page', { tag: [...FlowTags.CUSTOMER_NUTRITION, RoleTags.USER] }, () => {

  const todayLog = {
    id: 1,
    date: new Date().toISOString().slice(0, 10),
    is_closed: false,
    closed_at: null,
    notes: '',
    program_goal: 'general_health',
    trainer_nutrition_note: null as string | null,
    meal_entries: [
      {
        id: 11,
        meal_block: 'desayuno',
        status: 'not_done',
        notes: '',
        photo_url: null,
        suggestion: {
          id: 101,
          title: 'Avena con frutas',
          description: 'Avena cocida con banano y arándanos',
          calories_estimate: 420,
          meal_block: 'desayuno',
          foods: [],
        },
      },
      {
        id: 12,
        meal_block: 'almuerzo',
        status: 'completed',
        notes: '',
        photo_url: null,
        suggestion: {
          id: 102,
          title: 'Pollo con arroz integral',
          description: 'Pechuga de pollo a la plancha con arroz integral y ensalada',
          calories_estimate: 580,
          meal_block: 'almuerzo',
          foods: [],
        },
      },
    ],
  };

  const approvedHabitsEntry = {
    id: 1,
    customer_id: 999,
    created_at: '2026-01-10T10:00:00Z',
    meals_per_day: 4,
    water_liters: '2.5',
    fruit_weekly: 5,
    vegetable_weekly: 6,
    protein_frequency: 4,
    ultraprocessed_weekly: 2,
    sugary_drinks_weekly: 1,
    eats_breakfast: true,
    notes: '',
    habit_score: '7.8',
    habit_category: 'Buenos hábitos',
    habit_color: 'green',
    trainer_notes: '',
    trainer_approved_at: '2026-01-12T09:00:00Z',
  };

  async function mockNutrition(
    page: import('@playwright/test').Page,
    opts: { daily?: typeof todayLog | null; habits?: typeof approvedHabitsEntry[] } = {},
  ) {
    await injectAuthCookies(page);
    await setupDefaultApiMocks(page, ['my-nutrition']);
    await page.route('**/api/nutrition/access/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ has_nutrition_access: true, price_cop: 30000 }) }));
    await page.route('**/api/my-nutrition/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(opts.habits ?? []),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(approvedHabitsEntry),
        });
      }
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

  test('renders the current date as the page heading', async ({ page }) => {
    await mockNutrition(page, { daily: todayLog });
    await goToNutrition(page);

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();
  });

  test('shows "Sin plan activo" hero when there is no active program', async ({ page }) => {
    await mockNutrition(page, { daily: null });
    await goToNutrition(page);

    await expect(page.getByRole('heading', { name: 'Sin plan activo' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ver mi programa/ })).toBeVisible();
  });

  test('renders the daily nutrition hero with the calorie ring', async ({ page }) => {
    await mockNutrition(page, { daily: todayLog });
    await goToNutrition(page);

    await expect(page.getByRole('heading', { name: 'Tu día, en equilibrio.' })).toBeVisible();
    await expect(page.getByText('Consumidas')).toBeVisible();
    await expect(page.getByText(/de \d+ kcal/)).toBeVisible();
  });

  test('renders the meal timeline with suggested meals', async ({ page }) => {
    await mockNutrition(page, { daily: todayLog });
    await goToNutrition(page);

    await expect(page.getByText('Tu día · timeline')).toBeVisible();
    // El rediseño muestra el nombre de la receta como título de la card
    // (los ingredientes/descripción quedan en el panel expandido).
    await expect(page.getByText(/Avena con frutas/)).toBeVisible();
    await expect(page.getByText(/Pollo con arroz integral/)).toBeVisible();
  });

  test('renders the collapsible trainer note when the program has a nutrition note', async ({ page }) => {
    await mockNutrition(page, { daily: { ...todayLog, trainer_nutrition_note: 'Sube la proteína en el almuerzo.' } });
    await goToNutrition(page);

    // La nota del coach es ahora una franja colapsable dentro de la card principal.
    const coachNote = page.getByRole('button', { name: /Nota de tu coach/ });
    await expect(coachNote).toBeVisible();
    await coachNote.click();
    await expect(page.getByText(/Sube la proteína en el almuerzo/)).toBeVisible();
  });

  test('renders the weekly habits score block once the trainer approved it', async ({ page }) => {
    await mockNutrition(page, { daily: todayLog, habits: [approvedHabitsEntry] });
    await goToNutrition(page);

    await expect(page.getByRole('button', { name: /Actualizar hábitos de la semana/ })).toBeVisible();
    await expect(page.getByText(/Score semanal/)).toBeVisible();
  });

  test('opening the habits form modal shows the update-habits sheet', async ({ page }) => {
    await mockNutrition(page, { daily: todayLog, habits: [approvedHabitsEntry] });
    await goToNutrition(page);

    await page.getByRole('button', { name: /Actualizar hábitos de la semana/ }).click();

    await expect(page.getByRole('heading', { name: 'Actualizar hábitos' })).toBeVisible();
    await expect(page.getByText('Proteína de calidad')).toBeVisible();
  });

  test('submitting the habits form posts to /my-nutrition/ and closes the modal', async ({ page }) => {
    await mockNutrition(page, { daily: todayLog, habits: [approvedHabitsEntry] });
    await goToNutrition(page);

    await page.getByRole('button', { name: /Actualizar hábitos de la semana/ }).click();
    await expect(page.getByRole('heading', { name: 'Actualizar hábitos' })).toBeVisible();

    // Fill a couple of fields: bump the first stepper ("Comidas al día") and add notes.
    await page.getByRole('button', { name: 'Aumentar' }).first().click();
    await page.getByPlaceholder(/Algo que quieras contarle a tu coach/).fill('Buena semana, subí la proteína.');

    // mockNutrition already fulfills POST /api/my-nutrition/ with a 201 entry.
    const habitsPost = page.waitForResponse(
      (response) =>
        response.url().includes('/api/my-nutrition/') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    // Waiting for the POST proves the form actually submitted; the observable
    // outcome is the modal closing on a successful save.
    await habitsPost;
    await expect(page.getByRole('heading', { name: 'Actualizar hábitos' })).not.toBeVisible();
  });
});
