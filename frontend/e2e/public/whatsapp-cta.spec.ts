import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Public WhatsApp floating CTA', { tag: [...FlowTags.PUBLIC_WHATSAPP_CTA, RoleTags.GUEST] }, () => {
  test('home page shows WhatsApp link with api.whatsapp.com href', { tag: ['@outcome:display'] }, async ({ page }) => {
    // quality: allow-no-interaction (la clase display de este flow ES el render de la vista; no hay acción previa que ejecutar)
    // quality: allow-deep-link (página pública: la URL es una entrada legítima del sitio, no saltea navegación)
    await page.goto('/');

    const waLink = page.getByRole('link', { name: 'Contáctanos por WhatsApp' });
    await expect(waLink).toBeVisible();
    await expect(waLink).toHaveAttribute('href', /api\.whatsapp\.com/);
  });
});
