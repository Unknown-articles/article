/**
 * Frontend Suite 4 – Persistence
 * Verifies that localStorage keys are set correctly on login and cleared on logout,
 * and that the app restores the session on page reload.
 */

const { test, expect } = require('@playwright/test');
const { apiRegister, loginViaUI, resetApp, uniqueUser } = require('../helpers');

const PASSWORD = 'secret123';

test.describe('Persistence', () => {
  test('chat_token is set in localStorage after login', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    const token = await page.evaluate(() => localStorage.getItem('chat_token'));
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(10);
  });

  test('chat_user is set in localStorage after login', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    const raw = await page.evaluate(() => localStorage.getItem('chat_user'));
    expect(raw).toBeTruthy();
    const user = JSON.parse(raw);
    expect(user.username).toBe(username);
    expect(user.userId).toBeTruthy();
  });

  test('chat_user contains userId and username fields', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    const user = await page.evaluate(() => JSON.parse(localStorage.getItem('chat_user')));
    expect(typeof user.userId).toBe('number');
    expect(user.username).toBe(username);
  });

  test('session is restored on reload: chat-container still visible', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('chat-container')).toBeVisible({ timeout: 8_000 });
  });

  test('auth-form is NOT shown after reload when session exists', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('auth-form')).not.toBeVisible();
  });

  test('current-username is correct after reload', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('current-username')).toContainText(username);
  });

  test('logout clears chat_token from localStorage', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    await page.getByTestId('btn-logout').click();

    const token = await page.evaluate(() => localStorage.getItem('chat_token'));
    expect(token).toBeNull();
  });

  test('logout clears chat_user from localStorage', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    await page.getByTestId('btn-logout').click();

    const user = await page.evaluate(() => localStorage.getItem('chat_user'));
    expect(user).toBeNull();
  });

  test('after logout and reload, auth-form is shown (no session restored)', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);

    await page.getByTestId('btn-logout').click();
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('auth-form')).toBeVisible();
  });
});
