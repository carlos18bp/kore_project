import { test, expect } from '../fixtures';

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

test.describe('Contact Page', () => {

  test('renders the contact page heading', async ({ page }) => {
    await visitContactPage(page);
    await expect(page.getByRole('heading', { name: 'Estamos aquí para ayudarte' })).toBeVisible();
  });

  test('renders the contact page subtitle', async ({ page }) => {
    await visitContactPage(page);
    await expect(page.getByText('¿Tienes preguntas sobre nuestros programas')).toBeVisible();
  });

  test('renders contact information section', async ({ page }) => {
    await visitContactPage(page);
    await expect(page.getByRole('heading', { name: 'Información de contacto' })).toBeVisible();
    await expect(page.getByText('Ubicación')).toBeVisible();
    await expect(page.getByText('Horario de atención')).toBeVisible();
  });

  test('renders the contact form', async ({ page }) => {
    await visitContactPage(page);
    await expect(page.getByRole('heading', { name: 'Envíanos un mensaje' })).toBeVisible();
    await expect(page.getByLabel('Nombre *')).toBeVisible();
    await expect(page.getByLabel('Email *')).toBeVisible();
    await expect(page.getByLabel('Teléfono (opcional)')).toBeVisible();
    await expect(page.getByLabel('Mensaje *')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeVisible();
  });

  test('form requires name field', async ({ page }) => {
    await visitContactPage(page);
    const submitButton = page.getByRole('button', { name: 'Enviar mensaje' });
    await submitButton.click();

    // HTML5 validation should prevent submission
    const nameInput = page.getByLabel('Nombre *');
    await expect(nameInput).toBeFocused();
  });

  test('form requires email field', async ({ page }) => {
    await visitContactPage(page);
    await page.getByLabel('Nombre *').fill('Test User');
    const submitButton = page.getByRole('button', { name: 'Enviar mensaje' });
    await submitButton.click();

    // HTML5 validation should prevent submission and focus email
    const emailInput = page.getByLabel('Email *');
    await expect(emailInput).toBeFocused();
  });

  test('form requires message field', async ({ page }) => {
    await visitContactPage(page);
    await page.getByLabel('Nombre *').fill('Test User');
    await page.getByLabel('Email *').fill('test@example.com');
    const submitButton = page.getByRole('button', { name: 'Enviar mensaje' });
    await submitButton.click();

    // HTML5 validation should prevent submission and focus message
    const messageInput = page.getByLabel('Mensaje *');
    await expect(messageInput).toBeFocused();
  });

  test('form can be filled with valid data', async ({ page }) => {
    await visitContactPage(page);
    await page.getByLabel('Nombre *').fill('Test User');
    await page.getByLabel('Email *').fill('test@example.com');
    await page.getByLabel('Teléfono (opcional)').fill('+57 300 123 4567');
    await page.getByLabel('Mensaje *').fill('This is a test message for the contact form.');

    // Verify all fields have the correct values
    await expect(page.getByLabel('Nombre *')).toHaveValue('Test User');
    await expect(page.getByLabel('Email *')).toHaveValue('test@example.com');
    await expect(page.getByLabel('Teléfono (opcional)')).toHaveValue('+57 300 123 4567');
    await expect(page.getByLabel('Mensaje *')).toHaveValue('This is a test message for the contact form.');
  });

  test('navbar shows Contacto link as active', async ({ page }) => {
    await visitContactPage(page);
    const nav = page.getByRole('navigation');
    const contactLink = nav.getByRole('link', { name: 'Contacto' }).first();
    await expect(contactLink).toHaveClass(/text-kore-red/);
  });

  test('displays city from site settings', async ({ page }) => {
    await visitContactPage(page);
    await expect(page.getByText('Bogotá, Colombia')).toBeVisible();
  });

  test('submits the contact form successfully', async ({ page }) => {
    await visitContactPage(page);
    await page.route('**/api/contact-messages/**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      } else {
        await route.fallback();
      }
    });

    await page.getByLabel('Nombre *').fill('Test User');
    await page.getByLabel('Email *').fill('test@example.com');
    await page.getByLabel('Teléfono (opcional)').fill('+57 300 123 4567');
    await page.getByLabel('Mensaje *').fill('Necesito ayuda con mi plan.');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByText('¡Mensaje enviado!')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar otro mensaje' }).click();
    await expect(page.getByLabel('Nombre *')).toHaveValue('');
    await expect(page.getByLabel('Email *')).toHaveValue('');
    await expect(page.getByLabel('Teléfono (opcional)')).toHaveValue('');
    await expect(page.getByLabel('Mensaje *')).toHaveValue('');
  });

  test('shows an error message when contact submission fails', async ({ page }) => {
    await visitContactPage(page);
    await page.route('**/api/contact-messages/**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Error' }) });
      } else {
        await route.fallback();
      }
    });

    await page.getByLabel('Nombre *').fill('Test User');
    await page.getByLabel('Email *').fill('test@example.com');
    await page.getByLabel('Mensaje *').fill('Necesito ayuda con mi plan.');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();

    await expect(page.getByText('No pudimos enviar tu mensaje. Por favor, intenta de nuevo.')).toBeVisible();
  });

  test('uses fallback details when site settings request fails', async ({ page }) => {
    await page.route('**/api/site-settings/**', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Error' }) });
    });
    await page.goto('/contact');

    await expect(page.getByText('Medellín, Colombia')).toBeVisible();
    await expect(page.getByText('Lunes a Viernes: 6:00 AM - 8:00 PM')).toBeVisible();
    await expect(page.getByRole('link', { name: defaultSettings.email })).toHaveCount(0);
  });
});
