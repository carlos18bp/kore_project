import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const defaultSettings = {
  id: 1,
  company_name: 'KÓRE',
  email: 'hola@kore.com',
  phone: '+57 300 123 4567',
  whatsapp: '+57 300 123 4567',
  address: 'Calle 93 #11-26',
  city: 'Bogotá',
  business_hours: 'Lunes a Viernes: 6:00 AM - 8:00 PM',
};

async function visitContactPage(page: import('@playwright/test').Page, settings = defaultSettings) {
  await page.route('**/api/site-settings/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(settings),
    });
  });
  await page.goto('/contact');
}

test.describe('Contact Page', { tag: [...FlowTags.PUBLIC_CONTACT, RoleTags.GUEST] }, () => {
  test('requires name before submitting message', async ({ page }) => {
    await visitContactPage(page);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    const nameInput = page.getByLabel('Nombre *');
    await expect(nameInput).toBeFocused();
  });

  test('submits contact form successfully', async ({ page }) => {
    await visitContactPage(page);
    await page.route('**/api/contact-messages/**', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );

    await page.getByLabel('Nombre *').fill('Test User');
    await page.getByLabel('Email *').fill('test@example.com');
    await page.getByLabel('Teléfono (opcional)').fill('+57 300 123 4567');
    await page.getByLabel('Mensaje *').fill('Necesito ayuda con mi plan.');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByText('¡Mensaje enviado!')).toBeVisible();
  });

  test('shows error when contact submission fails', async ({ page }) => {
    await visitContactPage(page);
    await page.route('**/api/contact-messages/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Error' }) }),
    );

    await page.getByLabel('Nombre *').fill('Test User');
    await page.getByLabel('Email *').fill('test@example.com');
    await page.getByLabel('Mensaje *').fill('Necesito ayuda con mi plan.');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByText('No pudimos enviar tu mensaje. Por favor, intenta de nuevo.')).toBeVisible();
  });
});
