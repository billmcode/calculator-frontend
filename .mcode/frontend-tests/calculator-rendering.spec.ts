import { test, expect } from '@playwright/test';

// Structural + visual rendering checks for the single-view calculator SPA.
// Selectors avoid CSS-module hashed class names (unstable across builds) in
// favor of accessible role/text locators and DOM structure, per the QA
// report's guidance (qa-report.md, "Flow: Digit entry with leading-zero
// replacement").

test.describe('Calculator rendering', () => {
  test('loads the main view with no uncaught exceptions', async ({ page }) => {
    // On mount, useCalculator() fires a GET /api/calculations to populate
    // history (loadHistory()). No backend is reachable in this sandbox (see
    // qa-report.md setup notes: both origin and target proxy /api to
    // localhost:8000, which nothing is listening on here), so Vite's dev
    // proxy answers with a 500, and Chromium logs a benign
    // "Failed to load resource: ... 500" resource-load message to the
    // console for that failed fetch - this happens identically on the
    // Angular origin for the same reason, and the hook swallows the
    // rejection itself (`loadHistory()`'s `.then(_, () => {})`). That
    // expected, environment-caused network log is filtered out below; any
    // *other* console error (a real app bug) still fails this test.
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const unexpectedConsoleErrors = consoleErrors.filter(
      (text) => !/Failed to load resource.*(500|Internal Server Error)/i.test(text),
    );

    expect(pageErrors).toEqual([]);
    expect(unexpectedConsoleErrors).toEqual([]);
  });

  test('renders display showing 0 and the full keypad grid', async ({ page }) => {
    await page.goto('/');

    // Display area: expression line empty, result line showing "0".
    const resultLine = page.locator('[class*="display"] [class*="result"]');
    await expect(resultLine).toHaveText('0');

    // 19 keypad buttons total: C, +/-, %, ÷, 7 8 9 ×, 4 5 6 −, 1 2 3 +, 0 . =
    const expectedLabels = [
      'C',
      '+/-',
      '%',
      '÷',
      '7',
      '8',
      '9',
      '×',
      '4',
      '5',
      '6',
      '−',
      '1',
      '2',
      '3',
      '+',
      '0',
      '.',
      '=',
    ];
    const buttons = page.locator('[class*="buttons"] button');
    await expect(buttons).toHaveCount(expectedLabels.length);

    for (const label of expectedLabels) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('renders the History panel heading alongside the calculator', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  });
});

test.describe('Dark iOS calculator theme colors', () => {
  // Colors verified by qa_agent via getComputedStyle on both origin (Angular)
  // and target (React) apps - see qa-report.md "Flow: Dark iOS calculator
  // theme colors". Asserting the same computed values here locks in parity.

  test('page background is black', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  });

  test('calculator panel background is #1c1c1e', async ({ page }) => {
    await page.goto('/');
    const calculatorPanel = page.locator('[class*="display"]').locator('..');
    await expect(calculatorPanel).toHaveCSS('background-color', 'rgb(28, 28, 30)');
  });

  test('history panel background is #1c1c1e', async ({ page }) => {
    await page.goto('/');
    const historyPanel = page.getByRole('heading', { name: 'History' }).locator('..');
    await expect(historyPanel).toHaveCSS('background-color', 'rgb(28, 28, 30)');
  });

  test('operator buttons are #ff9f0a', async ({ page }) => {
    await page.goto('/');
    for (const label of ['+/-', '%', '÷', '×', '−', '+']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCSS(
        'background-color',
        'rgb(255, 159, 10)',
      );
    }
  });

  test('equals button is #30d158', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '=', exact: true })).toHaveCSS(
      'background-color',
      'rgb(48, 209, 88)',
    );
  });

  test('digit buttons are #3a3a3c', async ({ page }) => {
    await page.goto('/');
    for (const label of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCSS(
        'background-color',
        'rgb(58, 58, 60)',
      );
    }
  });
});
