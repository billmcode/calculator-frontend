import { test, expect, type Page } from '@playwright/test';

// Digit entry / decimal / sign / percent / clear behavior, ported 1:1 from
// Angular's useCalculator-equivalent logic (see useCalculator.ts). Steps and
// expected display values come from qa-report.md's "Flow: Digit entry with
// leading-zero replacement", "Flow: Decimal point entry", and "Flow: Sign
// toggle (+/-) and percent (%)".

function display(page: Page) {
  return page.locator('[class*="display"] [class*="result"]');
}

function clickDigit(page: Page, digit: string) {
  return page.getByRole('button', { name: digit, exact: true }).click();
}

test.describe('Digit entry', () => {
  test('replaces the leading 0 rather than appending to it', async ({ page }) => {
    await page.goto('/');
    await expect(display(page)).toHaveText('0');

    await clickDigit(page, '5');
    await expect(display(page)).toHaveText('5');

    await clickDigit(page, '7');
    // Must be "57", not "057" - the replace-on-zero rule.
    await expect(display(page)).toHaveText('57');
  });

  test('appends subsequent digits once the display is non-zero', async ({ page }) => {
    await page.goto('/');
    await clickDigit(page, '5');
    await clickDigit(page, '7');
    await clickDigit(page, '3');
    await expect(display(page)).toHaveText('573');
  });

  test('clicking 0 on a non-zero display appends rather than replaces', async ({ page }) => {
    await page.goto('/');
    await clickDigit(page, '5');
    await clickDigit(page, '0');
    await expect(display(page)).toHaveText('50');
  });
});

test.describe('Decimal entry', () => {
  test('only allows a single decimal point', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '.', exact: true }).click();
    await expect(display(page)).toHaveText('0.');

    await clickDigit(page, '5');
    await expect(display(page)).toHaveText('0.5');

    // Second and third "." clicks are no-ops.
    await page.getByRole('button', { name: '.', exact: true }).click();
    await expect(display(page)).toHaveText('0.5');
    await page.getByRole('button', { name: '.', exact: true }).click();
    await expect(display(page)).toHaveText('0.5');
  });
});

test.describe('Sign toggle and percent', () => {
  test('+/- toggles the sign of the current display value', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '.', exact: true }).click();
    await clickDigit(page, '5');
    await expect(display(page)).toHaveText('0.5');

    await page.getByRole('button', { name: '+/-', exact: true }).click();
    await expect(display(page)).toHaveText('-0.5');

    await page.getByRole('button', { name: '+/-', exact: true }).click();
    await expect(display(page)).toHaveText('0.5');
  });

  test('% divides the current display value by 100', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '.', exact: true }).click();
    await clickDigit(page, '5');
    await expect(display(page)).toHaveText('0.5');

    await page.getByRole('button', { name: '%', exact: true }).click();
    await expect(display(page)).toHaveText('0.005');
  });
});

test.describe('Clear', () => {
  test('C resets the display and expression to their initial state', async ({ page }) => {
    await page.goto('/');
    await clickDigit(page, '5');
    await page.getByRole('button', { name: '+', exact: true }).click();
    await clickDigit(page, '3');
    await expect(display(page)).toHaveText('3');

    await page.getByRole('button', { name: 'C', exact: true }).click();
    await expect(display(page)).toHaveText('0');
    await expect(page.locator('[class*="display"] [class*="expression"]')).toHaveText('');
  });
});
