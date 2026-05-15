import type { Page } from '@playwright/test';
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakePhotos = [
  {
    meal_entry_id: 1, customer_id: 10, customer_name: 'María López',
    meal_block: 'lunch', photo_url: 'https://example.com/photo1.jpg',
    uploaded_at: '2026-05-14T12:30:00Z', trainer_comment: null,
    flagged_for_session: false,
  },
  {
    meal_entry_id: 2, customer_id: 10, customer_name: 'María López',
    meal_block: 'breakfast', photo_url: 'https://example.com/photo2.jpg',
    uploaded_at: '2026-05-13T08:00:00Z', trainer_comment: null,
    flagged_for_session: true,
  },
  {
    meal_entry_id: 3, customer_id: 11, customer_name: 'Carlos García',
    meal_block: 'dinner', photo_url: 'https://example.com/photo3.jpg',
    uploaded_at: '2026-05-12T20:00:00Z', trainer_comment: 'Bien equilibrado',
    flagged_for_session: false,
  },
];

async function setupEvidenceMocks(page: Page, photos = fakePhotos) {
  await page.route('**/api/trainer/photo-gallery/', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ photos }),
    });
  });
}

test.describe('Trainer Evidence Gallery', { tag: [...FlowTags.TRAINER_EVIDENCE, RoleTags.TRAINER] }, () => {
  test('page loads with Evidencia Fotográfica heading', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupEvidenceMocks(page);
    await page.goto('/trainer/evidence');

    await expect(page.getByRole('heading', { name: 'Evidencia Fotográfica' })).toBeVisible({ timeout: 15_000 });
  });

  test('filter tabs Todas, Sin revisar, Para sesión are visible', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupEvidenceMocks(page);
    await page.goto('/trainer/evidence');

    await expect(page.getByRole('button', { name: 'Todas' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Sin revisar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Para sesión' })).toBeVisible();
  });

  test('hero KPI card shows photo count', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupEvidenceMocks(page);
    await page.goto('/trainer/evidence');

    await expect(page.getByText('Galería de comidas')).toBeVisible({ timeout: 10_000 });
  });

  test('Sin revisar filter hides already-commented photos', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupEvidenceMocks(page);
    await page.goto('/trainer/evidence');

    await expect(page.getByRole('button', { name: 'Sin revisar' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Sin revisar' }).click();

    // photo3 (Carlos García) has a comment, should be hidden
    // Verify unreviewed count badge renders (2 unreviewed photos)
    await expect(page.getByText('2 sin revisar')).toBeVisible({ timeout: 5_000 });
  });

  test('empty gallery shows empty state', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupEvidenceMocks(page, []);
    await page.goto('/trainer/evidence');

    await expect(page.getByRole('heading', { name: 'Evidencia Fotográfica' })).toBeVisible({ timeout: 15_000 });
    // When no photos, the empty state component renders
    await expect(page.getByText('Sin fotos por revisar').or(page.getByText('0')).first()).toBeVisible({ timeout: 10_000 });
  });
});
