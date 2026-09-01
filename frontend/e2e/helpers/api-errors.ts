import type { Page } from '@playwright/test';

/**
 * Reusable API error-injection helpers for E2E specs.
 *
 * Register these BEFORE `setupDefaultApiMocks` / navigation, same as any custom
 * route override (Playwright routes are LIFO — the last registered handler for
 * a matching URL wins, see ERROR-003 in docs/methodology/error-documentation.md).
 */

interface MockApiErrorOptions {
  /** Only intercept this HTTP method; other methods fall through to the next handler. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Override the response content type (default application/json). */
  contentType?: string;
}

/**
 * Answer `urlPattern` with an HTTP error status and a JSON body.
 *
 * Example:
 *   await mockApiError(page, '**' + '/api/bookings/', 500);
 *   await mockApiError(page, /\/api\/trainer\/clients\/\d+\/$/, 404, { detail: 'No encontrado' }, { method: 'GET' });
 */
export async function mockApiError(
  page: Page,
  urlPattern: string | RegExp,
  status: number,
  body: Record<string, unknown> = { detail: 'Error simulado en E2E' },
  options: MockApiErrorOptions = {},
) {
  await page.route(urlPattern, async (route) => {
    if (options.method && route.request().method() !== options.method) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status,
      contentType: options.contentType ?? 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/**
 * Simulate a network-level failure (connection refused) for `urlPattern`.
 * Use for offline/timeout UX assertions where no HTTP response exists at all.
 */
export async function mockApiNetworkFailure(
  page: Page,
  urlPattern: string | RegExp,
  options: Pick<MockApiErrorOptions, 'method'> = {},
) {
  await page.route(urlPattern, async (route) => {
    if (options.method && route.request().method() !== options.method) {
      await route.fallback();
      return;
    }
    await route.abort('connectionrefused');
  });
}
