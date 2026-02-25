import { test, expect } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Terms & Conditions page (/terms).
 * Covers page rendering, content sections, and navigation links.
 */
test.describe('Terms & Conditions Page', { tag: [...FlowTags.PUBLIC_TERMS, RoleTags.GUEST] }, () => {
  test('renders terms page with main heading', async ({ page }) => {
    await page.goto('/terms');

    await expect(page.getByRole('heading', { level: 1, name: 'Términos y Condiciones' })).toBeVisible();
    await expect(page.getByText('Documento Legal')).toBeVisible();
  });

  test('displays contract clauses', async ({ page }) => {
    await page.goto('/terms');

    await expect(page.getByRole('heading', { name: 'PRIMERA — OBJETO' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SEGUNDA — DEFINICIONES' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'TERCERA — DURACIÓN DEL CONTRATO' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CUARTA — PRECIO Y FORMA DE PAGO' })).toBeVisible();
  });

  test('displays acceptance notice at the bottom', async ({ page }) => {
    await page.goto('/terms');

    await expect(
      page.getByText('Al reservar cualquier programa de KÓRE, el usuario declara haber leído'),
    ).toBeVisible();
  });

  test('back link navigates to programs page', async ({ page }) => {
    await page.goto('/terms');

    const backLink = page.getByRole('link', { name: 'Volver a Programas' });
    await expect(backLink).toBeVisible();
    await backLink.click();

    await expect(page).toHaveURL('/programs');
  });
});
