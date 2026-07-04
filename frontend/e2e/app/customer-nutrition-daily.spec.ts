import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the daily nutrition tracker on /my-nutrition.
 *
 * The daily tracker is driven by `useNutritionDailyStore` (GET
 * /api/my-nutrition-daily/today/). It renders the calorie hero, a hydration
 * card and a per-meal timeline. Meal completion and hydration are captured with
 * the phone camera (`CameraCapture` → getUserMedia), so those controls are
 * gated behind a mobile device: this file spoofs an iPhone user-agent so the
 * "Foto" and water-glass controls become interactive.
 *
 * NOTE on photo/water POSTs: `CameraCapture` uses `getUserMedia` + a `<canvas>`
 * snapshot — there is NO `<input type="file">`, so `setInputFiles` cannot drive
 * it and, without a fake media device configured in playwright.config.ts, the
 * capture never produces a file. We therefore assert that the camera capture UI
 * opens (the only reliable, config-independent contract) rather than the upload
 * POST itself. The meal-status PATCH is covered via the non-camera
 * "Marcar como hecha" / "Omití esta comida" controls.
 */
test.describe('Customer Daily Nutrition Tracker', { tag: [...FlowTags.CUSTOMER_NUTRITION_DAILY, RoleTags.USER] }, () => {

  // isMobileDevice() reads navigator.userAgent, so spoof an iPhone UA to unlock
  // the camera-gated controls. Mobile viewport mirrors mobile-bottom-nav.spec.
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });

  const today = new Date().toISOString().slice(0, 10);

  const breakfast = {
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
  };

  const lunch = {
    id: 12,
    meal_block: 'almuerzo',
    status: 'completed' as const,
    notes: '',
    photo_url: null as string | null,
    suggestion: {
      id: 102,
      title: 'Pollo con arroz integral',
      description: 'Pechuga de pollo a la plancha con arroz integral',
      calories_estimate: 580,
      meal_block: 'almuerzo',
      foods: [],
    },
  };

  const todayLog = {
    id: 1,
    date: today,
    is_closed: false,
    closed_at: null,
    notes: '',
    program_goal: 'general_health',
    trainer_nutrition_note: null as string | null,
    water_glasses: [] as { id: number; photo_url: string | null; created_at: string }[],
    meal_entries: [breakfast, lunch],
  };

  // A day where the first meal already has a photo but is still not_done, so the
  // in-panel "Marcar como hecha" button is available (non-camera completion).
  const photographedLog = {
    ...todayLog,
    meal_entries: [{ ...breakfast, photo_url: 'https://example.com/desayuno.jpg' }, lunch],
  };

  async function mockDaily(
    page: import('@playwright/test').Page,
    daily: typeof todayLog | null,
  ) {
    await injectAuthCookies(page);
    // setupDefaultApiMocks provides GET /my-nutrition/ -> [] (habits) which is
    // all we need here; the habits score block stays hidden.
    await setupDefaultApiMocks(page);
    await page.route('**/api/my-nutrition-plans/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/my-nutrition-daily/today/', async (route) => {
      if (daily === null) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'No active program' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(daily) });
      }
    });
    // Meal status PATCH — echo the requested status back as a MealEntry.
    await page.route('**/api/my-nutrition-daily/*/meals/*/', async (route) => {
      let body: { status?: string; notes?: string } = {};
      try { body = route.request().postDataJSON(); } catch { /* no body */ }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 11,
          meal_block: 'desayuno',
          status: body.status ?? 'completed',
          notes: body.notes ?? '',
          photo_url: null,
          suggestion: breakfast.suggestion,
        }),
      });
    });
  }

  async function goToNutrition(page: import('@playwright/test').Page) {
    await page.goto('/my-nutrition');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  }

  test('renders the daily nutrition tracker with hero, hydration and meal timeline', async ({ page }) => {
    await mockDaily(page, todayLog);
    await goToNutrition(page);

    // Calorie hero
    await expect(page.getByRole('heading', { name: 'Tu día, en equilibrio.' })).toBeVisible();
    await expect(page.getByText('Consumidas')).toBeVisible();
    await expect(page.getByText(/de \d+ kcal/)).toBeVisible();
    // Hydration card
    await expect(page.getByText('Hidratación')).toBeVisible();
    // Meal timeline
    await expect(page.getByText('Tu día · timeline')).toBeVisible();
    await expect(page.getByText('Avena con frutas')).toBeVisible();
  });

  test('marking a photographed meal as done sends a PATCH to the meal entry', async ({ page }) => {
    await mockDaily(page, photographedLog);
    await goToNutrition(page);

    // Expand the breakfast card, then confirm via the non-camera button.
    await page.getByText('Avena con frutas').click();

    const patch = page.waitForRequest(
      (r) =>
        r.url().includes('/api/my-nutrition-daily/') &&
        r.url().includes('/meals/') &&
        r.method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Marcar como hecha' }).click();
    const request = await patch;
    expect(request.postDataJSON()).toMatchObject({ status: 'completed' });
  });

  test('omitting a meal sends a skipped PATCH to the meal entry', async ({ page }) => {
    await mockDaily(page, todayLog);
    await goToNutrition(page);

    // Expand the not-done breakfast card to reveal the "Omití esta comida" control.
    await page.getByText('Avena con frutas').click();

    const patch = page.waitForRequest(
      (r) =>
        r.url().includes('/api/my-nutrition-daily/') &&
        r.url().includes('/meals/') &&
        r.method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Omití esta comida' }).click();
    const request = await patch;
    expect(request.postDataJSON()).toMatchObject({ status: 'skipped' });
  });

  test('tapping the next water glass opens the hydration selfie camera', async ({ page }) => {
    await mockDaily(page, todayLog);
    await goToNutrition(page);

    // Hydration card is expanded by default; the first glass is the next one.
    await page.getByRole('button', { name: 'Registrar vaso 1 con selfie' }).click();

    // CameraCapture renders a labelled dialog regardless of camera availability.
    await expect(page.getByRole('dialog', { name: 'Selfie de hidratación' })).toBeVisible();
  });

  test('tapping a meal Foto action opens the meal camera capture', async ({ page }) => {
    await mockDaily(page, todayLog);
    await goToNutrition(page);

    // Only the not-done breakfast exposes a "Foto" button (lunch is completed).
    await page.getByRole('button', { name: 'Foto' }).click();

    await expect(page.getByRole('dialog', { name: 'Foto de la comida' })).toBeVisible();
  });
});
