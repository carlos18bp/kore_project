import type { Page } from '@playwright/test';
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const fakeAlerts = [
  {
    id: 1, customer_id: 10, customer_name: 'María López', avatar_url: null,
    level: 'alto', computed_at: '2026-05-14T10:00:00Z', kore_score: null,
    signals_count: 1,
    behavioral_signals: [
      { type: 'missed_sessions', label: '3 sesiones perdidas esta semana', severity: 'alto', detail: 'Ha faltado a 3 sesiones en los últimos 7 días.', since_date: '2026-05-10', module: undefined },
    ],
    clinical_signals: [],
    resolutions: [],
  },
  {
    id: 2, customer_id: 11, customer_name: 'Carlos García', avatar_url: null,
    level: 'medio', computed_at: '2026-05-13T08:00:00Z', kore_score: null,
    signals_count: 1,
    behavioral_signals: [],
    clinical_signals: [
      { type: 'low_nutrition', label: 'Adherencia nutricional < 50%', severity: 'medio', detail: 'Solo registró 3 de 7 comidas.', since_date: '2026-05-13', module: undefined },
    ],
    resolutions: [],
  },
  {
    id: 3, customer_id: 12, customer_name: 'Ana Torres', avatar_url: null,
    level: 'bajo', computed_at: '2026-05-12T07:00:00Z', kore_score: null,
    signals_count: 1,
    behavioral_signals: [
      { type: 'declining_mood', label: 'Tendencia a la baja en bienestar', severity: 'bajo', detail: 'Promedio de bienestar bajó de 7 a 4.', since_date: '2026-05-12', module: undefined },
    ],
    clinical_signals: [],
    resolutions: [],
  },
];

async function setupAlertsMocks(page: Page, alerts = fakeAlerts) {
  await page.route(/\/api\/trainer\/alerts\/(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ alerts }),
      });
    } else {
      await route.continue();
    }
  });
  await page.route('**/api/trainer/alerts/*/resolve/', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/trainer/dashboard-stats/', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total_clients: 3, today_sessions: 1, upcoming_sessions: [] }),
    });
  });
}

test.describe('Trainer Alerts Center', { tag: [...FlowTags.TRAINER_ALERTS, RoleTags.TRAINER] }, () => {
  test('page loads and shows Centro de Alertas heading', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAlertsMocks(page);
    await page.goto('/trainer/alerts');

    await expect(page.getByRole('heading', { name: 'Centro de Alertas' })).toBeVisible({ timeout: 15_000 });
  });

  test('hero card shows active alerts count label', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAlertsMocks(page);
    await page.goto('/trainer/alerts');

    await expect(page.getByText('Alertas activas', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Resueltas hoy')).toBeVisible();
  });

  test('alert cards render customer names', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAlertsMocks(page);
    await page.goto('/trainer/alerts');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Carlos García')).toBeVisible();
  });

  test('filter by Alto shows only alto-level alerts', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAlertsMocks(page);
    await page.goto('/trainer/alerts');

    await expect(page.getByText('María López')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Alto' }).click();

    await expect(page.getByText('María López')).toBeVisible();
    await expect(page.getByText('Carlos García')).not.toBeVisible();
    await expect(page.getByText('Ana Torres')).not.toBeVisible();
  });

  test('resolve sheet opens when Resolver alerta is clicked', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAlertsMocks(page);
    await page.goto('/trainer/alerts');

    await expect(page.getByRole('button', { name: 'Resolver alerta' }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Resolver alerta' }).first().click();

    await expect(page.getByText('Resolver alerta').nth(1)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
  });

  test('empty state shown when no alerts', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupAlertsMocks(page, []);
    await page.goto('/trainer/alerts');

    await expect(page.getByText('No hay alertas activas')).toBeVisible({ timeout: 15_000 });
  });
});
