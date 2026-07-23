import type { Page } from '@playwright/test';
import type { AvailabilityMap } from '@/lib/stores/bookingStore';
import { makeAvailability } from '../factories';

/**
 * Override the availability map the booking calendar reads.
 *
 * Register BEFORE `setupDefaultApiMocks` (or pass `exclude: ['availability']`
 * to it) — Playwright routes are LIFO, so the last matching handler wins.
 */
export async function mockAvailability(
  page: Page,
  map: AvailabilityMap = makeAvailability(),
) {
  await page.route('**/api/availability/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(map),
    });
  });
}

/** No bookable slots at all — every calendar day renders disabled. */
export async function mockNoAvailability(page: Page) {
  await mockAvailability(page, {});
}
