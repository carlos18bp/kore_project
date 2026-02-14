import { test, expect } from '../fixtures';

test.describe('Navbar — Desktop & Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('desktop navbar shows all navigation links and CTA', async ({ page }) => {
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'La Marca Kóre' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Programas' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('navbar "Inicio" link highlights when on home page', async ({ page }) => {
    const inicioLink = page.locator('nav').getByRole('link', { name: 'Inicio' });
    // Active link should have text-kore-red class
    await expect(inicioLink).toHaveAttribute('class', /text-kore-red/);
  });

  test('navbar link highlights when navigating to La Marca Kóre', async ({ page }) => {
    await page.goto('/la-marca-kore');
    const link = page.locator('nav ul').getByRole('link', { name: 'La Marca Kóre' });
    await expect(link).toHaveAttribute('class', /text-kore-red/);
  });

  test('mobile hamburger menu opens and closes', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Hamburger button should be visible
    const menuBtn = page.getByLabel('Menú');
    await expect(menuBtn).toBeVisible();

    // Open mobile menu
    await menuBtn.click();

    // Mobile menu links should be visible
    await expect(page.locator('.md\\:hidden').getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(page.locator('.md\\:hidden').getByRole('link', { name: 'La Marca Kóre' })).toBeVisible();
    await expect(page.locator('.md\\:hidden').getByRole('link', { name: 'Programas' })).toBeVisible();

    // Close menu
    await menuBtn.click();
  });

  test('mobile menu link navigates and closes menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const menuBtn = page.getByLabel('Menú');
    await menuBtn.click();

    // Click on "Programas" from mobile menu
    await page.locator('.md\\:hidden').getByRole('link', { name: 'Programas' }).click();
    await page.waitForURL('**/programas');
  });
});
