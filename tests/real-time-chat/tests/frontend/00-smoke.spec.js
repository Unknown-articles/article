/**
 * Frontend Suite 0 – Smoke
 * Verifies the app is reachable and all required data-testid elements are present.
 */

const { test, expect } = require('@playwright/test');
const { FRONTEND_URL, resetApp } = require('../helpers');

test.describe('Smoke', () => {
  test('app is accessible on port 5173', async ({ page }) => {
    const res = await page.goto(FRONTEND_URL);
    expect(res?.status()).toBe(200);
  });

  test('React root is mounted', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await expect(page.locator('#root')).toBeAttached();
  });

  test('auth-form is visible on first load', async ({ page }) => {
    await resetApp(page);
    await expect(page.getByTestId('auth-form')).toBeVisible();
  });

  test('tab-login and tab-register are present', async ({ page }) => {
    await resetApp(page);
    await expect(page.getByTestId('tab-login')).toBeVisible();
    await expect(page.getByTestId('tab-register')).toBeVisible();
  });

  test('input-username and input-password are present', async ({ page }) => {
    await resetApp(page);
    await expect(page.getByTestId('input-username')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
  });

  test('btn-submit is present', async ({ page }) => {
    await resetApp(page);
    await expect(page.getByTestId('btn-submit')).toBeVisible();
  });

  test('auth-form starts in login mode (data-mode="login")', async ({ page }) => {
    await resetApp(page);
    await expect(page.getByTestId('auth-form')).toHaveAttribute('data-mode', 'login');
  });
});
