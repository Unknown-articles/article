/**
 * Test Suite 8 – Persistence (localStorage key: "tasks")
 */

const { test, expect } = require('@playwright/test');
const { resetApp, addTask, getTasks, taskCard } = require('./helpers');

const FUTURE_DATE = '2099-12-31';

test.describe('Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('tasks are written to localStorage key "tasks" immediately after creation', async ({ page }) => {
    await addTask(page, { title: 'Persisted', date: FUTURE_DATE });

    const tasks = await getTasks(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe('Persisted');
  });

  test('tasks survive a full page reload', async ({ page }) => {
    await addTask(page, { title: 'Reload Test', date: FUTURE_DATE });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('task-title').getByText('Reload Test', { exact: true })).toBeVisible();
  });

  test('completed state (data-completed) persists after reload', async ({ page }) => {
    await addTask(page, { title: 'Persist Complete', date: FUTURE_DATE });

    await taskCard(page, 'Persist Complete').getByTestId('task-checkbox').click();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = page.getByTestId('task-item')
      .filter({ has: page.getByTestId('task-title').getByText('Persist Complete', { exact: true }) })
      .first();

    await expect(card).toHaveAttribute('data-completed', 'true');
  });

  test('multiple tasks persist across reload', async ({ page }) => {
    await addTask(page, { title: 'Alpha', date: FUTURE_DATE });
    await addTask(page, { title: 'Beta',  date: FUTURE_DATE });
    await addTask(page, { title: 'Gamma', date: FUTURE_DATE });

    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(await page.getByTestId('task-item').count()).toBe(3);
  });

  test('deleted tasks are removed from localStorage', async ({ page }) => {
    await addTask(page, { title: 'Ephemeral', date: FUTURE_DATE });

    await taskCard(page, 'Ephemeral').getByTestId('task-delete-btn').click();
    await page.waitForTimeout(300);

    const tasks = await getTasks(page);
    expect(tasks.length).toBe(0);
  });

  test('deleted tasks do not reappear after reload', async ({ page }) => {
    await addTask(page, { title: 'Gone', date: FUTURE_DATE });

    await taskCard(page, 'Gone').getByTestId('task-delete-btn').click();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(await page.getByTestId('task-title').getByText('Gone', { exact: true }).count()).toBe(0);
  });

  test('localStorage "tasks" key matches what is shown in the UI', async ({ page }) => {
    await addTask(page, { title: 'Sync Check', date: FUTURE_DATE });

    const tasks = await getTasks(page);
    expect(tasks.length).toBe(1);

    await expect(
      page.getByTestId('task-title').getByText(tasks[0].title, { exact: true })
    ).toBeVisible();
  });
});
