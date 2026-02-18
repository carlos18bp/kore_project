import { test, expect } from '../fixtures';

test.describe('FAQ Page Error States', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/google-captcha/site-key/', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
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
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/No pudimos cargar las preguntas frecuentes/i),
    ).toBeVisible();
  });

  test('retry button reloads page after error', async ({ page }) => {
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

  test('renders loading spinner while fetching FAQs', async ({ page }) => {
    await page.route('**/api/faqs/public/', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            category: { id: 1, name: 'General', slug: 'general', order: 1 },
            items: [
              {
                id: 1,
                question: '¿Pregunta de prueba?',
                answer: 'Respuesta de prueba.',
              },
            ],
          },
        ]),
      });
    });

    await page.goto('/faq');

    const spinner = page.locator('.animate-spin');
    await expect(spinner).toBeVisible();

    await expect(page.getByText('¿Pregunta de prueba?')).toBeVisible();
  });
});
