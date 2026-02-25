import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('FAQ Page', { tag: [...FlowTags.PUBLIC_FAQ, RoleTags.GUEST] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/faqs/public/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            category: { id: 1, name: 'General', slug: 'general', order: 1 },
            items: [
              {
                id: 1,
                question: '¿Pregunta frecuente de prueba?',
                answer: 'Respuesta frecuente de prueba.',
              },
            ],
          },
        ]),
      }),
    );
    await page.goto('/faq');
    await expect(page).toHaveURL(/\/faq$/);
  });

  test('guest expands an FAQ answer', async ({ page }) => {
    const firstButton = page.getByRole('button', { name: '¿Pregunta frecuente de prueba?' });
    await expect(firstButton).toBeVisible();

    await firstButton.click();
    await expect(firstButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Respuesta frecuente de prueba.')).toBeVisible();
  });

  test('guest navigates to contact from FAQ CTA', async ({ page }) => {
    const contactLink = page.getByRole('link', { name: 'Contacto' }).first();
    await expect(contactLink).toBeVisible();

    await contactLink.click();
    await expect(page).toHaveURL('/contact');
  });
});
