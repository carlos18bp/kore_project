import { test, expect, E2E_TRAINER, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * E2E tests for the Trainer Clients page (/trainer/clients).
 * Covers client list rendering, search filtering, empty states, and quick actions.
 */
test.describe('Trainer Clients Page', { tag: [...FlowTags.TRAINER_CLIENTS_LIST, RoleTags.TRAINER] }, () => {

  const fakeClients = [
    {
      id: 1,
      first_name: 'María',
      last_name: 'López',
      email: 'maria@example.com',
      avatar_url: null,
      primary_goal: 'fat_loss',
      active_package: 'Plan Elite',
      completed_sessions: 5,
      sessions_remaining: 3,
    },
    {
      id: 2,
      first_name: 'Carlos',
      last_name: 'Gómez',
      email: 'carlos@example.com',
      avatar_url: null,
      primary_goal: 'muscle_gain',
      active_package: 'Plan Pro',
      completed_sessions: 12,
      sessions_remaining: 0,
    },
  ];

  async function setupTrainerClientsMocks(page: import('@playwright/test').Page, clients = fakeClients) {
    await page.route('**/api/trainer/my-clients/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clients),
      });
    });
    await page.route('**/api/trainer/dashboard-stats/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_clients: clients.length, today_sessions: 0, upcoming_sessions: [] }),
      });
    });
  }

  test('renders page heading and search input', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByRole('heading', { level: 1, name: 'Mis Clientes' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Gestión')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar cliente por nombre o email...')).toBeVisible();
  });

  test('renders client cards with names, emails, and goals', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('maria@example.com')).toBeVisible();
    await expect(page.getByText('Perder grasa')).toBeVisible();

    await expect(page.getByText('Carlos Gómez')).toBeVisible();
    await expect(page.getByText('carlos@example.com')).toBeVisible();
    await expect(page.getByText('Ganar masa muscular')).toBeVisible();
  });

  test('renders client stats (package, sessions, remaining)', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByText('Plan Elite')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('5 sesiones')).toBeVisible();
    await expect(page.getByText('3 rest.')).toBeVisible();

    await expect(page.getByText('Plan Pro')).toBeVisible();
    await expect(page.getByText('12 sesiones')).toBeVisible();
  });

  test('renders quick action links (Ficha and Antropometría)', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 15_000 });

    const fichaLinks = page.getByRole('link', { name: 'Ficha' });
    await expect(fichaLinks.first()).toBeVisible();

    const anthropoLinks = page.getByRole('link', { name: 'Antropometría' });
    await expect(anthropoLinks.first()).toBeVisible();
  });

  test('search filters clients by name', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Carlos Gómez')).toBeVisible();

    await page.getByPlaceholder('Buscar cliente por nombre o email...').fill('María');

    await expect(page.getByText('María López')).toBeVisible();
    await expect(page.getByText('Carlos Gómez')).not.toBeVisible();
  });

  test('search filters clients by email', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Buscar cliente por nombre o email...').fill('carlos@');

    await expect(page.getByText('Carlos Gómez')).toBeVisible();
    await expect(page.getByText('María López')).not.toBeVisible();
  });

  test('search with no results shows empty message', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Buscar cliente por nombre o email...').fill('nonexistent');

    await expect(page.getByText('No se encontraron clientes con esa búsqueda.')).toBeVisible();
  });

  test('empty client list shows placeholder', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page, []);
    await page.goto('/trainer/clients');

    await expect(page.getByRole('heading', { level: 1, name: 'Mis Clientes' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Aún no tienes clientes asignados.')).toBeVisible();
  });

  test('client avatar shows first letter when no avatar_url', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupTrainerClientsMocks(page);
    await page.goto('/trainer/clients');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('span').filter({ hasText: /^M$/ }).first()).toBeVisible();
  });
});
