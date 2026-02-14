import { test as base, expect, type Page } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

/**
 * Dedicated E2E test-user credentials.
 * The user must exist in the backend DB (created via management command or shell).
 */
export const E2E_USER = {
  email: 'e2e@kore.com',
  password: 'e2e123456',
  firstName: 'Usuario',
  lastName: 'Prueba',
  fullName: 'Usuario Prueba',
};

/**
 * Shared login helper — fills the login form and waits for redirect to /dashboard.
 */
export async function loginAsTestUser(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/Correo electrónico/i).fill(E2E_USER.email);
  await page.getByLabel(/Contraseña/i).fill(E2E_USER.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL('**/dashboard', { timeout: 60_000 });
}

/**
 * Custom Playwright fixture that automatically collects V8 code coverage
 * for every test. All E2E specs should import { test, expect } from this file.
 */
export const test = base.extend({
  autoTestFixture: [async ({ page }, use) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use('autoTestFixture');
    const jsCoverage = await page.coverage.stopJSCoverage();
    await addCoverageReport(jsCoverage, test.info());
  }, { scope: 'test', auto: true }],
});

export { expect };
