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
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Ver programas' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
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

  test('navigates to #programs via CTA link', async ({ page }) => {
    await page.getByRole('link', { name: 'Ver programas' }).click();
    await expect(page).toHaveURL('/#programs');
  });

  test('navbar is visible with navigation links', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inicio' }).first()).toBeVisible();
  });

  test('scrolling through page triggers scroll animations on all sections', async ({ page }) => {
    // Scroll through all major sections to trigger GSAP ScrollTrigger animations
    // This exercises useTextReveal (PricingTable) and useScrollAnimations hooks
    // covering: fade-up, split-text, stagger-children, fade-left, fade-right, scale-in

    // Scroll to Programs section (scale-in animations)
    await page.getByText('Programas FLW').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Scroll to Pricing section (useTextReveal: split-text, fade-up, stagger-children)
    await page.getByText('Invierte en tu salud').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(page.getByText('Invierte en tu salud')).toBeVisible();

    // Scroll to Process section (fade-left, fade-right animations)
    await page.getByText('Cómo funciona').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(page.getByText('Cómo funciona')).toBeVisible();

    // Scroll all the way to bottom to ensure all ScrollTriggers fire
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  });

  test('Process section triggers fade-left and fade-right animations', async ({ page }) => {
    // This exercises useScrollAnimations.ts lines 39-41 (fade-left, fade-right branches)
    const processSection = page.locator('section').filter({ hasText: 'El proceso KÓRE' });

    // Scroll to Process section to trigger animations
    await processSection.scrollIntoViewIfNeeded();

    // Wait for GSAP animations to initialize and process
    await page.waitForTimeout(1000);

    // Verify fade-left element is visible (the image container)
    await expect(processSection.locator('[data-animate="fade-left"]')).toBeVisible();

    // Verify fade-right elements are visible (the step cards)
    const fadeRightElements = processSection.locator('[data-animate="fade-right"]');
    await expect(fadeRightElements.first()).toBeVisible();

    // Scroll a bit more to ensure all ScrollTriggers fire
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(500);

    // Verify all 6 steps are rendered
    await expect(fadeRightElements).toHaveCount(6);
  });

  test('PricingTable tab switching changes displayed program', async ({ page }) => {
    // This exercises PricingTable.tsx setActiveTab function
    // Scroll to pricing section and wait for it to be in viewport
    const pricingHeading = page.getByRole('heading', { name: 'Invierte en tu salud' });
    await pricingHeading.scrollIntoViewIfNeeded();
    await expect(pricingHeading).toBeInViewport();

    // Default should show Personalizado
    const personalizadoTab = page.getByRole('button', { name: 'Personalizado', exact: true });
    await expect(personalizadoTab).toHaveClass(/bg-kore-red-bright/);

    // Click Semi-personalizado tab
    const semiTab = page.getByRole('button', { name: 'Semi-personalizado', exact: true });
    await semiTab.click();
    await expect(semiTab).toHaveClass(/bg-kore-red-light/, { timeout: 5_000 });

    // Click Terapéutico tab
    const terapeuticoTab = page.getByRole('button', { name: 'Terapéutico', exact: true });
    await terapeuticoTab.click();
    await expect(terapeuticoTab).toHaveClass(/bg-kore-red-lightest/, { timeout: 5_000 });

    // Click back to Personalizado
    await personalizadoTab.click();
    await expect(personalizadoTab).toHaveClass(/bg-kore-red-bright/, { timeout: 5_000 });
  });
});
