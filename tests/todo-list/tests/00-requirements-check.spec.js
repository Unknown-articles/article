/**
 * Test Suite 0 – Requirements Smoke Check
 */

const { test, expect } = require('@playwright/test');
const { BASE_URL } = require('./helpers');

test.describe('Requirements Smoke Check', () => {
  test('app is accessible on port 3001', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);
  });

  test('page title or heading is set', async ({ page }) => {
    await page.goto(BASE_URL);
    const title = await page.title();
    const heading = page.locator('h1, h2').first();
    const hasTitle = title.length > 0;
    const hasHeading = await heading.isVisible().catch(() => false);
    expect(hasTitle || hasHeading).toBe(true);
  });

  test('app renders a React root', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#root')).toBeAttached();
  });

  test('task form is present (data-testid="task-form")', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByTestId('task-form')).toBeVisible();
  });

  test('task input is present and focused (data-testid="task-input")', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByTestId('task-input')).toBeVisible();
    await expect(page.getByTestId('task-input')).toBeFocused();
  });

  test('filter buttons are present with correct data-testid attributes', async ({ page }) => {
    await page.goto(BASE_URL);
    for (const id of ['filter-all', 'filter-pending', 'filter-completed', 'filter-late']) {
      await expect(page.getByTestId(id), `data-testid="${id}" should be visible`).toBeVisible();
    }
  });

  test('action log panel is present (data-testid="action-log")', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByTestId('action-log')).toBeVisible();
  });
});
