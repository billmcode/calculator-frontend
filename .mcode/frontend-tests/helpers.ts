import type { Page } from '@playwright/test';

export function display(page: Page) {
  return page.locator('[class*="display"] [class*="result"]');
}

export function expression(page: Page) {
  return page.locator('[class*="display"] [class*="expression"]');
}
