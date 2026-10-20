import { test, expect } from '@playwright/test';
import { display, expression } from './helpers';

// Operator chaining triggers an intermediate backend call
// (POST /api/calculations) as soon as a second operator is pressed before
// "=". No real backend is reachable in this sandbox (per the FE testing
// context: both origin and target call a relative /api base with no server
// behind it here), so this exercises the graceful-error path rather than a
// successful calculation - see qa-report.md "Flow: Operator chaining ->
// intermediate backend call -> graceful error". That error-path behavior
// (visible banner, no crash, state preserved) is itself the thing under test.

test.describe('Operator chaining and calculate (no backend present)', () => {
  test('chaining a second operator shows a graceful "Calculation failed" error, not a crash', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/');

    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '+', exact: true }).click();
    await expect(expression(page)).toHaveText('5 +');

    await page.getByRole('button', { name: '1', exact: true }).click();
    // A different operator before "=" triggers the intermediate backend call.
    await page.getByRole('button', { name: '−', exact: true }).click();

    // Allow the failed fetch to settle - qa-report.md notes the rejection is
    // async even against a closed port, so don't assert on the same tick.
    await expect(page.getByText('Calculation failed')).toBeVisible({ timeout: 5000 });

    // Expression keeps showing the pending operator; display still holds the
    // second operand, since the failed call must not overwrite it.
    await expect(expression(page)).toHaveText('5 −');
    await expect(display(page)).toHaveText('1');

    // No unhandled exception reached the page.
    expect(pageErrors).toEqual([]);
  });

  test('pressing "=" against the unreachable backend also fails gracefully', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: '=', exact: true }).click();

    await expect(page.getByText('Calculation failed')).toBeVisible({ timeout: 5000 });
    await expect(expression(page)).toHaveText('5 + 3 =');
  });

  test('C clears the error banner and resets state after a failed calculation', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '−', exact: true }).click();
    await expect(page.getByText('Calculation failed')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'C', exact: true }).click();

    await expect(page.getByText('Calculation failed')).toHaveCount(0);
    await expect(display(page)).toHaveText('0');
    await expect(expression(page)).toHaveText('');
  });
});
