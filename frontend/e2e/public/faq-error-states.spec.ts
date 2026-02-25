import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('FAQ Page Error States', { tag: [...FlowTags.PUBLIC_FAQ_ERRORS, RoleTags.GUEST] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/google-captcha/site-key/', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    await expect(page.context().pages().length).toBeGreaterThan(0);
  });

  test('renders empty state when no FAQs are available', async ({ page }) => {
    await page.route('**/api/faqs/public/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await page.goto('/faq');
    await expect(page).toHaveURL(/\/faq$/);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText('No hay preguntas frecuentes disponibles en este momento.'),
    ).toBeVisible();
  });

  test('renders error message when FAQ API fails', async ({ page }) => {
    await page.route('**/api/faqs/public/', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' }),
      }),
    );

    await page.goto('/faq');
    await expect(page).toHaveURL(/\/faq$/);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/No pudimos cargar las preguntas frecuentes/i),
    ).toBeVisible();
  });

  test('shows retry button when FAQ API fails', async ({ page }) => {
    await page.route('**/api/faqs/public/', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' }),
      }),
    );

    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/No pudimos cargar las preguntas frecuentes/i),
    ).toBeVisible();

    const retryButton = page.getByRole('button', { name: /Reintentar/i });
    await expect(retryButton).toBeVisible();
  });
});
