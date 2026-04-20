/**
 * Test Suite 1 – Task Model
 */

const { test, expect } = require('@playwright/test');
const { resetApp, addTask, getTasks } = require('./helpers');

const PAST_DATE   = '2020-01-01';
const FUTURE_DATE = '2099-12-31';

test.describe('Task Model', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('task saved to localStorage contains id, title, completed, date, createdAt', async ({ page }) => {
    await addTask(page, { title: 'Model Test Task', date: FUTURE_DATE });

    const tasks = await getTasks(page);
    expect(tasks.length).toBe(1);

    const task = tasks[0];
    expect(task).toHaveProperty('id');
    expect(task).toHaveProperty('title');
    expect(task).toHaveProperty('completed');
    expect(task).toHaveProperty('date');
    expect(task).toHaveProperty('createdAt');

    expect(task.title).toBe('Model Test Task');
    expect(task.completed).toBe(false);
    expect(task.id).toBeTruthy();
    expect(task.createdAt).toBeTruthy();
    expect(task.date).toBe(FUTURE_DATE);
  });

  test('each task has a unique id', async ({ page }) => {
    await addTask(page, { title: 'Task A', date: FUTURE_DATE });
    await addTask(page, { title: 'Task B', date: FUTURE_DATE });

    const tasks = await getTasks(page);
    expect(tasks.length).toBe(2);
    expect(new Set(tasks.map(t => t.id)).size).toBe(2);
  });

  test('task card exposes data-completed="false" when not completed', async ({ page }) => {
    await addTask(page, { title: 'Not Done', date: FUTURE_DATE });

    const card = page.getByTestId('task-item').first();
    await expect(card).toHaveAttribute('data-completed', 'false');
  });

  test('task card exposes data-late="false" for future due date', async ({ page }) => {
    await addTask(page, { title: 'Future Task', date: FUTURE_DATE });

    const card = page.getByTestId('task-item').first();
    await expect(card).toHaveAttribute('data-late', 'false');
  });

  test('task with past due date shows data-late="true" and badge-late', async ({ page }) => {
    await addTask(page, { title: 'Overdue Task', date: PAST_DATE });

    const card = page.getByTestId('task-item').first();
    await expect(card).toHaveAttribute('data-late', 'true');
    await expect(page.getByTestId('badge-late').first()).toBeVisible();
  });

  test('task card has data-task-id matching localStorage id', async ({ page }) => {
    await addTask(page, { title: 'ID Check', date: FUTURE_DATE });

    const tasks = await getTasks(page);
    const storedId = tasks[0].id;

    const card = page.getByTestId('task-item').first();
    await expect(card).toHaveAttribute('data-task-id', storedId);
  });
});
