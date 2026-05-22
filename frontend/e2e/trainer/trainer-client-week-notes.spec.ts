import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import type { Page } from '@playwright/test';

/**
 * E2E del subtab Programa → notas semanales en el detalle de cliente del entrenador.
 * Verifica el desbloqueo progresivo: la semana 1 es editable, la 2 está bloqueada,
 * y tras guardar la semana 1 la 2 se desbloquea.
 */
test.describe('Trainer Client — Notas semanales del programa', () => {

  const baseProgram = {
    id: 7,
    customer_id: 1,
    fitness_level: 2,
    goal: 'muscle_gain',
    start_date: '2026-05-01',
    end_date: '2026-05-28',
    status: 'published',
    trainer_notes: '',
    week_notes: [] as { week_number: number; notes: string; updated_at: string }[],
    current_week_note: null,
    approved_at: '2026-05-01T10:00:00Z',
    created_at: '2026-05-01T10:00:00Z',
    is_paused: false,
    days: [],
  };

  async function setupMocks(page: Page, weekNotes = baseProgram.week_notes) {
    await page.route('**/api/trainer/dashboard-stats/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ total_clients: 1, today_sessions: 0, upcoming_sessions: [] }) }));
    await page.route('**/api/trainer/my-clients/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/trainer/my-clients/1/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 1, first_name: 'Gustavo', last_name: 'Perez', email: 'g@test.com', role: 'customer' }) }));
    await page.route('**/api/monthly-programs/customer/1/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify([{ ...baseProgram, week_notes: weekNotes }]) }));
    // PATCH de la nota semanal
    await page.route('**/api/monthly-programs/7/week-notes/**', (route) => {
      const url = route.request().url();
      const week = Number(url.split('/week-notes/')[1].replace(/\//g, ''));
      const body = JSON.parse(route.request().postData() || '{}');
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 1, program_id: 7, week_number: week, notes: body.notes, updated_at: '2026-05-22T10:00:00Z' }) });
    });
  }

  async function openProgramaSubtab(page: Page) {
    // "Notas" vive en el rail lateral; "Programa" como subtab dentro de NotesTab.
    await page.getByTestId('tabbar-rail').getByRole('button', { name: 'Notas' }).click();
    await page.getByRole('button', { name: 'Programa', exact: true }).last().click();
  }

  test('la semana 2 está bloqueada hasta guardar la semana 1', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await openProgramaSubtab(page);

    await expect(page.getByText('Ciclos de 28 días')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Semana 1 de 4')).toBeVisible();
    await expect(page.getByText('Se desbloquea al guardar la semana anterior.').first()).toBeVisible();
  });

  test('tras guardar la semana 1 se desbloquea la semana 2', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await openProgramaSubtab(page);
    await expect(page.getByText('Semana 1 de 4')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder(/semana 1/i).fill('Foco en técnica de sentadilla');
    await page.getByRole('button', { name: 'Guardar' }).click();

    // La semana 2 pasa a ser el composer activo
    await expect(page.getByText('Semana 2 de 4')).toBeVisible({ timeout: 10_000 });
  });
});
