/**
 * Test Suite 7 – Action Log
 */

const { test, expect } = require('@playwright/test');
const { resetApp, addTask, taskCard } = require('./helpers');

const FUTURE_DATE = '2099-12-31';

test.describe('Action Log', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('action-log panel is visible on load', async ({ page }) => {
    await expect(page.getByTestId('action-log')).toBeVisible();
  });

  test('log panel header shows "Action Log"', async ({ page }) => {
    await expect(page.getByTestId('log-header')).toContainText('Action Log');
  });

  test('adding a task creates a log-entry with log-type ADD_TASK', async ({ page }) => {
    await addTask(page, { title: 'Logged Task', date: FUTURE_DATE });

    const entry = page.getByTestId('log-entry')
      .filter({ has: page.getByTestId('log-type').getByText('ADD_TASK', { exact: true }) })
      .first();

    await expect(entry).toBeVisible();
  });

  test('each log-entry has a log-timestamp', async ({ page }) => {
    await addTask(page, { title: 'Time Entry', date: FUTURE_DATE });

    const ts = await page.getByTestId('log-timestamp').first().innerText();
    expect(ts).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  test('deleting a task creates a log-entry with log-type DELETE_TASK', async ({ page }) => {
    await addTask(page, { title: 'Delete Logged', date: FUTURE_DATE });

    await taskCard(page, 'Delete Logged').getByTestId('task-delete-btn').click();
    await page.waitForTimeout(200);

    const entry = page.getByTestId('log-entry')
      .filter({ has: page.getByTestId('log-type').getByText('DELETE_TASK', { exact: true }) })
      .first();

    await expect(entry).toBeVisible();
  });

  test('completing a task creates a log-entry with log-type TOGGLE_TASK', async ({ page }) => {
    await addTask(page, { title: 'Toggle Logged', date: FUTURE_DATE });

    await taskCard(page, 'Toggle Logged').getByTestId('task-checkbox').click();
    await page.waitForTimeout(200);

    const entry = page.getByTestId('log-entry')
      .filter({ has: page.getByTestId('log-type').getByText('TOGGLE_TASK', { exact: true }) })
      .first();

    await expect(entry).toBeVisible();
  });

  test('editing a task creates a log-entry with log-type EDIT_TASK', async ({ page }) => {
    await addTask(page, { title: 'Edit Logged', date: FUTURE_DATE });

    await taskCard(page, 'Edit Logged').getByTestId('task-edit-btn').click();
    await page.waitForTimeout(200);

    await page.getByTestId('inline-edit-input').fill('Edit Logged V2');
    await page.getByTestId('inline-edit-save').click();
    await page.waitForTimeout(200);

    const entry = page.getByTestId('log-entry')
      .filter({ has: page.getByTestId('log-type').getByText('EDIT_TASK', { exact: true }) })
      .first();

    await expect(entry).toBeVisible();
  });

  test('multiple actions produce multiple log-entry elements', async ({ page }) => {
    await addTask(page, { title: 'Log One', date: FUTURE_DATE });
    await addTask(page, { title: 'Log Two', date: FUTURE_DATE });

    expect(await page.getByTestId('log-entry').count()).toBeGreaterThanOrEqual(2);
  });

  test('log panel can be collapsed and expanded', async ({ page }) => {
    await page.getByTestId('log-header').click();
    await page.waitForTimeout(200);
    await expect(page.getByTestId('log-entries')).not.toBeVisible();

    await page.getByTestId('log-header').click();
    await page.waitForTimeout(200);
    await expect(page.getByTestId('log-entries')).toBeVisible();
  });

  test('undo creates a log-entry with log-type UNDO', async ({ page }) => {
    await addTask(page, { title: 'Undo Log', date: FUTURE_DATE });

    await page.locator('body').click({ force: true });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    const entry = page.getByTestId('log-entry')
      .filter({ has: page.getByTestId('log-type').getByText('UNDO', { exact: true }) })
      .first();

    await expect(entry).toBeVisible();
  });
});
