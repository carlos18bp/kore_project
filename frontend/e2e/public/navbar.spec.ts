import { test, expect } from '../fixtures';

test.describe('Navbar — Desktop & Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('desktop navbar shows all navigation links and CTA', async ({ page }) => {
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'La Marca' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Programas' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('navbar "Inicio" link highlights when on home page', async ({ page }) => {
    const inicioLink = page.locator('nav').getByRole('link', { name: 'Inicio' });
    // Active link should have text-kore-red class
    await expect(inicioLink).toHaveAttribute('class', /text-kore-red/);
  });

  test('navbar link highlights when navigating to Kore Brand', async ({ page }) => {
    await page.goto('/kore-brand');
    const link = page.locator('nav ul').getByRole('link', { name: 'La Marca' });
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
    await expect(page.locator('.md\\:hidden').getByRole('link', { name: 'La Marca' })).toBeVisible();
    await expect(page.locator('.md\\:hidden').getByRole('link', { name: 'Programas' })).toBeVisible();

    // Close menu
    await menuBtn.click();
  });

  test('mobile menu link navigates and closes menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const menuBtn = page.getByLabel('Menú');
    await menuBtn.click();

    // Click on "Programs" from mobile menu
    await page.locator('.md\\:hidden').getByRole('link', { name: 'Programas' }).click();
    await page.waitForURL('**/programs');
  });

  test('mobile menu "Inicio" link closes menu via onClick handler', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const menuBtn = page.getByLabel('Menú');
    await menuBtn.click();

    // Target the menu div specifically (not the hamburger button which also has md:hidden)
    const mobileMenu = page.locator('div.md\\:hidden');
    // Menu should be open (max-h-80)
    await expect(mobileMenu).toHaveClass(/max-h-80/);

    // Click "Inicio" — stays on same page but closes the menu
    await mobileMenu.getByRole('link', { name: 'Inicio' }).click();

    // Menu should close (max-h-0)
    await expect(mobileMenu).toHaveClass(/max-h-0/, { timeout: 5_000 });
  });
});
