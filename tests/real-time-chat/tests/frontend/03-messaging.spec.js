/**
 * Frontend Suite 3 – Messaging
 * Verifies sending messages, data-testid attributes on message bubbles,
 * own vs other differentiation, and two-client broadcast.
 */

const { test, expect } = require('@playwright/test');
const {
  apiRegister,
  registerAndLoginViaUI,
  loginViaUI,
  waitForConnected,
  uniqueUser,
} = require('../helpers');

const PASSWORD = 'secret123';

test.describe('Messaging', () => {
  test('sent message appears in message-list with correct data-testid attributes', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);
    await waitForConnected(page);

    const text = `hello_${Date.now()}`;
    await page.getByTestId('input-message').fill(text);
    await page.getByTestId('btn-send').click();
    await page.waitForTimeout(500);

    // At least one message-item should exist
    const items = page.getByTestId('message-item');
    await expect(items.first()).toBeVisible();

    // The sent message must appear
    await expect(page.getByTestId('message-content').getByText(text, { exact: true })).toBeVisible();
  });

  test('own message has data-own="true"', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);
    await waitForConnected(page);

    const text = `own_${Date.now()}`;
    await page.getByTestId('input-message').fill(text);
    await page.getByTestId('btn-send').click();
    await page.waitForTimeout(500);

    const ownItem = page.getByTestId('message-item')
      .filter({ has: page.getByTestId('message-content').getByText(text, { exact: true }) })
      .first();

    await expect(ownItem).toHaveAttribute('data-own', 'true');
  });

  test('own message has data-message-id set to a numeric id', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);
    await waitForConnected(page);

    const text = `id_check_${Date.now()}`;
    await page.getByTestId('input-message').fill(text);
    await page.getByTestId('btn-send').click();
    await page.waitForTimeout(500);

    const ownItem = page.getByTestId('message-item')
      .filter({ has: page.getByTestId('message-content').getByText(text, { exact: true }) })
      .first();

    const msgId = await ownItem.getAttribute('data-message-id');
    expect(msgId).toBeTruthy();
    expect(Number(msgId)).toBeGreaterThan(0);
  });

  test('message-username shows "You" for own messages', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);
    await waitForConnected(page);

    const text = `you_${Date.now()}`;
    await page.getByTestId('input-message').fill(text);
    await page.getByTestId('btn-send').click();
    await page.waitForTimeout(500);

    const ownItem = page.getByTestId('message-item')
      .filter({ has: page.getByTestId('message-content').getByText(text, { exact: true }) })
      .first();

    await expect(ownItem.getByTestId('message-username')).toContainText('You');
  });

  test('message-timestamp is visible on each message', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);
    await waitForConnected(page);

    await page.getByTestId('input-message').fill(`ts_${Date.now()}`);
    await page.getByTestId('btn-send').click();
    await page.waitForTimeout(500);

    const ts = page.getByTestId('message-item').first().getByTestId('message-timestamp');
    await expect(ts).toBeVisible();
    const text = await ts.innerText();
    expect(text).toMatch(/\d{1,2}:\d{2}/); // HH:MM format
  });

  test('pressing Enter sends the message', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);
    await waitForConnected(page);

    const text = `enter_${Date.now()}`;
    await page.getByTestId('input-message').fill(text);
    await page.getByTestId('input-message').press('Enter');
    await page.waitForTimeout(500);

    await expect(page.getByTestId('message-content').getByText(text, { exact: true })).toBeVisible();
  });

  test('input-message is cleared after sending', async ({ page }) => {
    const username = uniqueUser();
    await apiRegister(username, PASSWORD);
    await loginViaUI(page, username, PASSWORD);
    await waitForConnected(page);

    await page.getByTestId('input-message').fill('clear me');
    await page.getByTestId('btn-send').click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId('input-message')).toHaveValue('');
  });

  test('message from another user has data-own="false"', async ({ browser }) => {
    const user1 = uniqueUser();
    const user2 = uniqueUser();
    await apiRegister(user1, PASSWORD);
    await apiRegister(user2, PASSWORD);

    // Open two separate browser contexts (two distinct users)
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await loginViaUI(page1, user1, PASSWORD);
    await loginViaUI(page2, user2, PASSWORD);
    await waitForConnected(page1);
    await waitForConnected(page2);

    // User1 sends a message
    const text = `cross_${Date.now()}`;
    await page1.getByTestId('input-message').fill(text);
    await page1.getByTestId('btn-send').click();
    await page2.waitForTimeout(800);

    // User2 must see the message with data-own="false"
    const item = page2.getByTestId('message-item')
      .filter({ has: page2.getByTestId('message-content').getByText(text, { exact: true }) })
      .first();

    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('data-own', 'false');

    // User2's message-username should show user1's name (not "You")
    await expect(item.getByTestId('message-username')).toContainText(user1);

    await ctx1.close();
    await ctx2.close();
  });

  test('messages are broadcast: user2 sees message sent by user1', async ({ browser }) => {
    const user1 = uniqueUser();
    const user2 = uniqueUser();
    await apiRegister(user1, PASSWORD);
    await apiRegister(user2, PASSWORD);

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await loginViaUI(page1, user1, PASSWORD);
    await loginViaUI(page2, user2, PASSWORD);
    await waitForConnected(page1);
    await waitForConnected(page2);

    const text = `broadcast_${Date.now()}`;
    await page1.getByTestId('input-message').fill(text);
    await page1.getByTestId('btn-send').click();
    await page2.waitForTimeout(800);

    await expect(
      page2.getByTestId('message-content').getByText(text, { exact: true })
    ).toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });
});
