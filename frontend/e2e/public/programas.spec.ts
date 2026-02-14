import { test, expect } from '../fixtures';

test.describe('Programas Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/programas');
  });

  test('renders the tariff badge and default program', async ({ page }) => {
    await expect(page.getByText('Tarifas 2026')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Personalizado FLW' })).toBeVisible();
    await expect(page.getByText('Tu proceso, tu ritmo')).toBeVisible();
  });

  test('shows plans for the default Personalizado program', async ({ page }) => {
    await expect(page.getByText('Sesión Individual')).toBeVisible();
    await expect(page.getByText('Programa Integral')).toBeVisible();
  });

  test('switches to Semi-personalizado tab and shows its plans', async ({ page }) => {
    await page.getByText('Semi-personalizado').first().click();
    await expect(page.getByRole('heading', { name: 'Semi-personalizado FLW' })).toBeVisible();
    await expect(page.getByText('Comparte el camino')).toBeVisible();
    await expect(page.getByText('Programa Inicial')).toBeVisible();
  });

  test('switches to Terapéutico tab and shows its plans', async ({ page }) => {
    const tab = page.locator('button', { hasText: 'Terapéutico' }).first();
    await tab.click({ force: true });
    await expect(page.getByRole('heading', { name: 'Terapéutico FLW' })).toBeVisible();
    await expect(page.getByText('Movimiento como medicina')).toBeVisible();
  });

  test('selecting a plan shows CTA "Reservar" button', async ({ page }) => {
    await page.getByText('Sesión Individual').click();
    await expect(page.getByRole('link', { name: /Reservar/ })).toBeVisible();
  });

  test('switching programs resets plan selection', async ({ page }) => {
    // Select a plan
    await page.getByText('Sesión Individual').click();
    await expect(page.getByRole('link', { name: /Reservar/ })).toBeVisible();

    // Switch program
    await page.getByText('Semi-personalizado').first().click();

    // CTA should disappear
    await expect(page.getByRole('link', { name: /Reservar/ })).not.toBeVisible();
  });
});
