/**
 * Frontend Suite 1 – Authentication
 * Covers register, login, logout, error messages, tab switching, and localStorage.
 */

const { test, expect } = require('@playwright/test');
const { resetApp, apiRegister, uniqueUser } = require('../helpers');

const PASSWORD = 'secret123';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  // ─── Tab switching ────────────────────────────────────────────────────────

  test('clicking tab-register sets data-mode="register"', async ({ page }) => {
    await page.getByTestId('tab-register').click();
    await expect(page.getByTestId('auth-form')).toHaveAttribute('data-mode', 'register');
  });

  test('clicking tab-login after register tab sets data-mode back to "login"', async ({ page }) => {
    await page.getByTestId('tab-register').click();
    await page.getByTestId('tab-login').click();
    await expect(page.getByTestId('auth-form')).toHaveAttribute('data-mode', 'login');
  });

  // ─── Register ─────────────────────────────────────────────────────────────

  test('registering a new user navigates to chat-container', async ({ page }) => {
    await page.getByTestId('tab-register').click();
    await page.getByTestId('input-username').fill(uniqueUser());
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-submit').click();

    await expect(page.getByTestId('chat-container')).toBeVisible({ timeout: 8_000 });
  });

  test('register with duplicate username shows auth-error', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD); // pre-register via API

    await page.getByTestId('tab-register').click();
    await page.getByTestId('input-username').fill(username);
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-submit').click();

    await expect(page.getByTestId('auth-error')).toBeVisible();
    await expect(page.getByTestId('auth-error')).toContainText(/taken|already/i);
  });

  test('register with username shorter than 3 chars is blocked by HTML validation', async ({ page }) => {
    await page.getByTestId('tab-register').click();
    await page.getByTestId('input-username').fill('ab');
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-submit').click();

    // Native HTML minLength prevents submission — chat should not appear
    await expect(page.getByTestId('chat-container')).not.toBeVisible();
  });

  // ─── Login ────────────────────────────────────────────────────────────────

  test('logging in with valid credentials navigates to chat-container', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);

    await page.getByTestId('input-username').fill(username);
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-submit').click();

    await expect(page.getByTestId('chat-container')).toBeVisible({ timeout: 8_000 });
  });

  test('login with wrong password shows auth-error', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);

    await page.getByTestId('input-username').fill(username);
    await page.getByTestId('input-password').fill('wrongpassword');
    await page.getByTestId('btn-submit').click();

    await expect(page.getByTestId('auth-error')).toBeVisible();
    await expect(page.getByTestId('auth-error')).toContainText(/invalid/i);
  });

  test('login with non-existent user shows auth-error', async ({ page }) => {
    await page.getByTestId('input-username').fill('doesnotexist_xyz');
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-submit').click();

    await expect(page.getByTestId('auth-error')).toBeVisible();
  });

  test('auth-error disappears when switching tabs', async ({ page }) => {
    // Trigger an error
    await page.getByTestId('input-username').fill('nobody_xyz');
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-submit').click();
    await expect(page.getByTestId('auth-error')).toBeVisible();

    // Switch tab — error must clear
    await page.getByTestId('tab-register').click();
    await expect(page.getByTestId('auth-error')).not.toBeVisible();
  });

  test('pressing Enter in the login form submits it (btn-submit has type="submit")', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);

    await page.getByTestId('input-username').fill(username);
    await page.getByTestId('input-password').fill(PASSWORD);
    // Press Enter inside the password field — only works if btn-submit is type="submit"
    await page.getByTestId('input-password').press('Enter');

    await expect(page.getByTestId('chat-container')).toBeVisible({ timeout: 8_000 });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────

  test('btn-logout returns to auth-form', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);

    await page.getByTestId('input-username').fill(username);
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-submit').click();
    await expect(page.getByTestId('chat-container')).toBeVisible({ timeout: 8_000 });

    await page.getByTestId('btn-logout').click();
    await expect(page.getByTestId('auth-form')).toBeVisible();
  });

  test('logout clears localStorage keys', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);

    await page.getByTestId('input-username').fill(username);
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-submit').click();
    await expect(page.getByTestId('chat-container')).toBeVisible({ timeout: 8_000 });

    await page.getByTestId('btn-logout').click();

    const storage = await page.evaluate(() => ({
      token: localStorage.getItem('chat_token'),
      user:  localStorage.getItem('chat_user'),
    }));

    expect(storage.token).toBeNull();
    expect(storage.user).toBeNull();
  });
});
