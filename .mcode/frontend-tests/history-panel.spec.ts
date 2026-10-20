import { test, expect } from '@playwright/test';

// History panel empty state - see qa-report.md "Flow: History panel empty
// state". A populated history state is a known gap (both origin and target
// require the out-of-scope /api backend to persist/fetch history, which is
// not present in this sandbox) and is intentionally not covered here.

test.describe('History panel - empty state', () => {
  test('shows the "History" heading and the empty-state message with no items', async ({ page }) => {
    await page.goto('/');

    const historyPanel = page.getByRole('heading', { name: 'History' }).locator('..');
    await expect(historyPanel.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(historyPanel.getByText('No calculations yet.', { exact: true })).toBeVisible();
    await expect(historyPanel.locator('li')).toHaveCount(0);
  });
});
