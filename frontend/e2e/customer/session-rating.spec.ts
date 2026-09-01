import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:customer-session-rating
 * The customer rates an attended session from the dashboard card.
 */

const PENDING = {
  count: 1,
  results: [{ id: 7, starts_at: '2026-07-13T15:00:00Z', trainer_name: 'Tina Trainer' }],
};

test.describe(
  'Customer — session rating',
  { tag: [...FlowTags.CUSTOMER_SESSION_RATING, RoleTags.USER] },
  () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }) => {
      await injectAuthCookies(page);
      await setupDefaultApiMocks(page);
    });

    test('rates an attended session and the card disappears', async ({ page }) => {
      let posted: Record<string, unknown> | null = null;
      await page.route('**/api/bookings/pending-rating/', (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }),
      );
      await page.route('**/api/bookings/7/rate/', (r) => {
        posted = r.request().postDataJSON();
        return r.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, score: 5, comment: '' }),
        });
      });

      await page.goto('/dashboard');
      await expect(page.getByTestId('session-rating-card')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Tina Trainer')).toBeVisible();

      await page.getByTestId('rating-star-5').click();
      await page.getByTestId('rating-submit').click();

      await expect(page.getByTestId('session-rating-card')).not.toBeVisible();
      expect(posted).toMatchObject({ score: 5 });
    });

    test('skipping dismisses the card without rating', async ({ page }) => {
      let rateCalled = false;
      await page.route('**/api/bookings/pending-rating/', (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }),
      );
      await page.route('**/api/bookings/7/rate/', (r) => {
        rateCalled = true;
        return r.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      });

      await page.goto('/dashboard');
      await expect(page.getByTestId('session-rating-card')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('rating-skip').click();

      // Skipping unmounts the card outright — SessionRatingCard returns null once
      // `skipped` is set — so the element must be gone from the DOM, not just hidden.
      await expect(page.getByTestId('session-rating-card')).toHaveCount(0);
      expect(rateCalled).toBe(false);
    });
  },
);
