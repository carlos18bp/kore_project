import { test, expect } from '../fixtures';

test.describe('FAQ Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/faq');
  });

  test('renders the FAQ page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '¿Tienes dudas? Aquí te ayudamos' })).toBeVisible();
  });

  test('renders the FAQ subtitle', async ({ page }) => {
    await expect(page.getByText('Encuentra respuestas a las preguntas más comunes')).toBeVisible();
  });

  test('renders the FAQ accordion component', async ({ page }) => {
    // Wait for FAQs to load (either shows accordion or empty state)
    await page.waitForLoadState('networkidle');

    // Check for either FAQ items or empty state message
    const faqItems = page.locator('button').filter({ hasText: '¿' });
    const emptyState = page.getByText('No hay preguntas frecuentes disponibles');

    const hasFaqs = await faqItems.count() > 0;
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    expect(hasFaqs || hasEmptyState).toBeTruthy();
  });

  test('accordion items expand and collapse on click', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find accordion buttons
    const accordionButtons = page.locator('button').filter({ hasText: '¿' });
    const count = await accordionButtons.count();

    if (count === 0) {
      // Skip if no FAQs available
      test.skip();
      return;
    }

    const firstButton = accordionButtons.first();
    await firstButton.click();

    // Check that the chevron rotates (indicating open state)
    const chevron = firstButton.locator('svg');
    await expect(chevron).toHaveClass(/rotate-180/);

    // Click again to collapse
    await firstButton.click();
    await expect(chevron).not.toHaveClass(/rotate-180/);
  });

  test('renders the contact CTA section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '¿No encontraste lo que buscabas?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contactar' })).toBeVisible();
  });

  test('contact CTA links to contact page', async ({ page }) => {
    const contactLink = page.getByRole('link', { name: 'Contactar' });
    await expect(contactLink).toHaveAttribute('href', '/contact');
  });

  test('navbar shows FAQ link as active', async ({ page }) => {
    const nav = page.getByRole('navigation');
    const faqLink = nav.getByRole('link', { name: 'FAQ' }).first();
    await expect(faqLink).toHaveClass(/text-kore-red/);
  });
});
