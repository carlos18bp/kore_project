import { test, expect, E2E_USER, loginAsTestUser } from '../fixtures';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('renders greeting with user first name', async ({ page }) => {
    await expect(page.getByText(`Hola, ${E2E_USER.firstName}`)).toBeVisible();
  });

  test('renders program info card', async ({ page }) => {
    await expect(page.getByText('Tu programa', { exact: true })).toBeVisible();
    // Dashboard currently shows hardcoded placeholder
    await expect(page.getByText('Sin programa activo').first()).toBeVisible();
  });

  test('renders sessions remaining', async ({ page }) => {
    await expect(page.getByText('Sesiones restantes')).toBeVisible();
  });

  test('renders next session card', async ({ page }) => {
    await expect(page.getByText('Próxima sesión')).toBeVisible();
  });

  test('renders quick action buttons', async ({ page }) => {
    await expect(page.getByText('Acciones rápidas')).toBeVisible();
    // Use role-based selectors to disambiguate sidebar link vs quick action button
    await expect(page.getByRole('button', { name: /Agendar sesión/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mi programa/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Historial/i })).toBeVisible();
  });

  test('renders recent activity section', async ({ page }) => {
    await expect(page.getByText('Actividad reciente')).toBeVisible();
  });

  test('renders user profile card', async ({ page }) => {
    await expect(page.getByText('Tu perfil')).toBeVisible();
    await expect(page.getByText(E2E_USER.fullName).first()).toBeVisible();
  });

  test('sidebar is visible with navigation', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Agendar Sesión' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mis Sesiones' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });
});
