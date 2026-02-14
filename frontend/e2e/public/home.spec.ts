import { test, expect } from '../fixtures';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the Hero section with KÓRE heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'KÓRE Health' })).toBeVisible();
  });

  test('renders the subtitle', async ({ page }) => {
    await expect(page.getByText('Del origen, al núcleo, al movimiento consciente')).toBeVisible();
  });

  test('renders CTA buttons', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Ver programas' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir al dashboard' })).toBeVisible();
  });

  test('renders the Philosophy section', async ({ page }) => {
    await expect(page.getByText('Nuestra filosofía')).toBeVisible();
  });

  test('renders the Programs section', async ({ page }) => {
    await expect(page.getByText('Programas FLW')).toBeVisible();
  });

  test('renders the Pricing section', async ({ page }) => {
    await expect(page.getByText('Tarifas 2026')).toBeVisible();
  });

  test('renders the Process section', async ({ page }) => {
    await expect(page.getByText('Cómo funciona')).toBeVisible();
  });

  test('renders the Gallery section', async ({ page }) => {
    await expect(page.getByText('Estilo visual')).toBeVisible();
  });

  test('navigates to #programas via CTA link', async ({ page }) => {
    await page.getByRole('link', { name: 'Ver programas' }).click();
    await expect(page).toHaveURL('/#programas');
  });

  test('navbar is visible with navigation links', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inicio' }).first()).toBeVisible();
  });
});
