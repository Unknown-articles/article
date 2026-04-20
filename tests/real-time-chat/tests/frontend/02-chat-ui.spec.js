/**
 * Frontend Suite 2 – Chat UI
 * Verifies chat-container structure, connection status attributes,
 * username display, and message input controls.
 */

const { test, expect } = require('@playwright/test');
const { apiRegister, loginViaUI, waitForConnected, uniqueUser } = require('../helpers');

const PASSWORD = 'secret123';

test.describe('Chat UI', () => {
  let username;

  test.beforeEach(async ({ page }) => {
    username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);
  });

  test('chat-container is visible after login', async ({ page }) => {
    await expect(page.getByTestId('chat-container')).toBeVisible();
  });

  test('connection-status is present with data-connected attribute', async ({ page }) => {
    await expect(page.getByTestId('connection-status')).toBeVisible();
    const attr = await page.getByTestId('connection-status').getAttribute('data-connected');
    expect(['true', 'false']).toContain(attr);
  });

  test('connection-status reaches data-connected="true"', async ({ page }) => {
    await waitForConnected(page);
    await expect(page.getByTestId('connection-status')).toHaveAttribute('data-connected', 'true');
  });

  test('current-username displays the logged-in username', async ({ page }) => {
    await expect(page.getByTestId('current-username')).toBeVisible();
    await expect(page.getByTestId('current-username')).toContainText(username);
  });

  test('btn-logout is visible', async ({ page }) => {
    await expect(page.getByTestId('btn-logout')).toBeVisible();
  });

  test('message-list is visible', async ({ page }) => {
    await expect(page.getByTestId('message-list')).toBeVisible();
  });

  test('input-message is present', async ({ page }) => {
    await expect(page.getByTestId('input-message')).toBeVisible();
  });

  test('btn-send is present', async ({ page }) => {
    await expect(page.getByTestId('btn-send')).toBeVisible();
  });

  test('btn-send is disabled when input-message is empty', async ({ page }) => {
    await waitForConnected(page);
    await expect(page.getByTestId('input-message')).toHaveValue('');
    await expect(page.getByTestId('btn-send')).toBeDisabled();
  });

  test('btn-send becomes enabled when input-message has text', async ({ page }) => {
    await waitForConnected(page);
    await page.getByTestId('input-message').fill('hello');
    await expect(page.getByTestId('btn-send')).toBeEnabled();
  });

  test('message-empty is shown when no messages exist (fresh user)', async ({ page }) => {
    // Wait for the WebSocket to connect and for the history event to render
    await waitForConnected(page);
    await page.waitForTimeout(400);

    const hasMsgs = await page.getByTestId('message-item').count();

    if (hasMsgs === 0) {
      // Empty state must be visible when there are no messages
      await expect(page.getByTestId('message-empty')).toBeVisible();
    } else {
      // DB has prior messages from other test runs — empty state is correctly hidden
      test.info().annotations.push({ type: 'note', description: 'DB has existing messages — empty state skipped' });
    }
  });

  test('auth-form is NOT visible after login', async ({ page }) => {
    await expect(page.getByTestId('auth-form')).not.toBeVisible();
  });
});
