import { test, expect } from '../fixtures';

test.describe('La Marca Kóre Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/la-marca-kore');
  });

  test('renders the hero section with brand heading', async ({ page }) => {
    await expect(page.getByText('La Marca').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /KÓRE/ }).first()).toBeVisible();
  });

  test('renders the subtitle', async ({ page }) => {
    await expect(page.getByText('Del origen, al núcleo, al movimiento consciente')).toBeVisible();
  });

  test('renders "Lo que nos hace diferentes" section', async ({ page }) => {
    await expect(page.getByText('Lo que nos hace diferentes')).toBeVisible();
    await expect(page.getByText('Desde el origen').first()).toBeVisible();
    await expect(page.getByText('Salud antes que exigencia')).toBeVisible();
    await expect(page.getByText('Procesos, no atajos')).toBeVisible();
  });

  test('renders the interactive flower section with pillar labels', async ({ page }) => {
    await expect(page.getByText('Equilibrio', { exact: true })).toBeVisible();
    await expect(page.getByText('Consciencia', { exact: true })).toBeVisible();
    await expect(page.getByText('Bienestar', { exact: true })).toBeVisible();
    await expect(page.getByText('Origen', { exact: true })).toBeVisible();
    await expect(page.getByText('Movimiento', { exact: true })).toBeVisible();
  });

  test('renders the diagnostic section', async ({ page }) => {
    await expect(page.getByText('Tu camino en KÓRE')).toBeVisible();
    await expect(page.getByText('Primer contacto')).toBeVisible();
    await expect(page.getByText('Diagnóstico completo')).toBeVisible();
  });

  test('renders program cards', async ({ page }) => {
    await expect(page.getByText('Personalizado FLW').first()).toBeVisible();
    await expect(page.getByText('Semi-personalizado FLW').first()).toBeVisible();
    await expect(page.getByText('Terapéutico FLW').first()).toBeVisible();
  });

  test('CTA "Nuestros programas" navigates to /programas', async ({ page }) => {
    await page.getByRole('link', { name: 'Nuestros programas' }).click();
    await expect(page).toHaveURL('/programas');
  });
});
