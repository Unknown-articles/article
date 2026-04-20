/**
 * Test Suite 6 – Undo / Redo
 */

const { test, expect } = require('@playwright/test');
const { resetApp, addTask, taskCard } = require('./helpers');

const FUTURE_DATE = '2099-12-31';

async function focusPage(page) {
  await page.locator('body').click({ position: { x: 1, y: 1 }, force: true });
  await page.waitForTimeout(50);
}

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('Ctrl+Z undoes adding a task', async ({ page }) => {
    await addTask(page, { title: 'Undo Me', date: FUTURE_DATE });
    await expect(page.getByTestId('task-title').getByText('Undo Me', { exact: true })).toBeVisible();

    await focusPage(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    expect(await page.getByTestId('task-title').getByText('Undo Me', { exact: true }).count()).toBe(0);
  });

  test('Ctrl+Shift+Z redoes an undone addition', async ({ page }) => {
    await addTask(page, { title: 'Redo Me', date: FUTURE_DATE });

    await focusPage(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    expect(await page.getByTestId('task-title').getByText('Redo Me', { exact: true }).count()).toBe(0);

    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);
    await expect(page.getByTestId('task-title').getByText('Redo Me', { exact: true })).toBeVisible();
  });

  test('Ctrl+Z undoes a deletion and restores the task', async ({ page }) => {
    const title = 'Deleted Then Restored';
    await addTask(page, { title, date: FUTURE_DATE });

    await taskCard(page, title).getByTestId('task-delete-btn').click();
    await page.waitForTimeout(200);
    expect(await page.getByTestId('task-title').getByText(title, { exact: true }).count()).toBe(0);

    await focusPage(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await expect(page.getByTestId('task-title').getByText(title, { exact: true })).toBeVisible();
  });

  test('Ctrl+Z undoes completing a task (data-completed reverts to "false")', async ({ page }) => {
    const title = 'Undo Complete';
    await addTask(page, { title, date: FUTURE_DATE });

    const card = taskCard(page, title);
    await card.getByTestId('task-checkbox').click();
    await page.waitForTimeout(200);
    await expect(card).toHaveAttribute('data-completed', 'true');

    await focusPage(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await expect(card).toHaveAttribute('data-completed', 'false');
  });

  test('multiple Ctrl+Z steps undo in order', async ({ page }) => {
    await addTask(page, { title: 'Task One', date: FUTURE_DATE });
    await addTask(page, { title: 'Task Two', date: FUTURE_DATE });

    await focusPage(page);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    expect(await page.getByTestId('task-title').getByText('Task Two', { exact: true }).count()).toBe(0);
    await expect(page.getByTestId('task-title').getByText('Task One', { exact: true })).toBeVisible();

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    expect(await page.getByTestId('task-title').getByText('Task One', { exact: true }).count()).toBe(0);
  });

  test('redo stack is cleared after a new action following an undo', async ({ page }) => {
    await addTask(page, { title: 'A', date: FUTURE_DATE });

    await focusPage(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    await addTask(page, { title: 'B', date: FUTURE_DATE });
    await page.waitForTimeout(200);

    await focusPage(page);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);

    await expect(page.getByTestId('task-title').getByText('B', { exact: true })).toBeVisible();
    expect(await page.getByTestId('task-title').getByText('A', { exact: true }).count()).toBe(0);
  });
});
