import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Public WhatsApp floating CTA', { tag: [...FlowTags.PUBLIC_WHATSAPP_CTA, RoleTags.GUEST] }, () => {
  test('home page shows WhatsApp link with api.whatsapp.com href', async ({ page }) => {
    await page.goto('/');

    const waLink = page.getByRole('link', { name: 'Contáctanos por WhatsApp' });
    await expect(waLink).toBeVisible();
    await expect(waLink).toHaveAttribute('href', /api\.whatsapp\.com/);
  });
});
