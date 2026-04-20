/**
 * Test Suite 2 – Task Management
 */

const { test, expect } = require('@playwright/test');
const { resetApp, addTask, taskCard } = require('./helpers');

const FUTURE_DATE = '2099-12-31';

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  // ─── Create ───────────────────────────────────────────────────────────────

  test('creates a new task visible in the list', async ({ page }) => {
    await addTask(page, { title: 'My First Task', date: FUTURE_DATE });

    await expect(page.getByTestId('task-title').getByText('My First Task', { exact: true })).toBeVisible();
  });

  test('new task is initially uncompleted (data-completed="false")', async ({ page }) => {
    await addTask(page, { title: 'Incomplete Task', date: FUTURE_DATE });

    await expect(page.getByTestId('task-item').first()).toHaveAttribute('data-completed', 'false');
  });

  test('task-list container is present', async ({ page }) => {
    await addTask(page, { title: 'List Check', date: FUTURE_DATE });

    await expect(page.getByTestId('task-list')).toBeVisible();
  });

  // ─── Complete / Uncomplete ────────────────────────────────────────────────

  test('clicking task-checkbox sets data-completed="true"', async ({ page }) => {
    await addTask(page, { title: 'Complete Me', date: FUTURE_DATE });

    const card = taskCard(page, 'Complete Me');
    await card.getByTestId('task-checkbox').click();
    await page.waitForTimeout(200);

    await expect(card).toHaveAttribute('data-completed', 'true');
  });

  test('task-checkbox aria-checked reflects completed state', async ({ page }) => {
    await addTask(page, { title: 'Aria Check', date: FUTURE_DATE });

    const card = taskCard(page, 'Aria Check');
    const checkbox = card.getByTestId('task-checkbox');

    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
    await checkbox.click();
    await page.waitForTimeout(200);
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  test('clicking task-checkbox again sets data-completed back to "false"', async ({ page }) => {
    await addTask(page, { title: 'Toggle Me', date: FUTURE_DATE });

    const card = taskCard(page, 'Toggle Me');
    const checkbox = card.getByTestId('task-checkbox');

    await checkbox.click();
    await page.waitForTimeout(200);
    await expect(card).toHaveAttribute('data-completed', 'true');

    await checkbox.click();
    await page.waitForTimeout(200);
    await expect(card).toHaveAttribute('data-completed', 'false');
  });

  // ─── Edit ─────────────────────────────────────────────────────────────────

  test('task-edit-btn opens inline editor', async ({ page }) => {
    await addTask(page, { title: 'Edit Me', date: FUTURE_DATE });

    await taskCard(page, 'Edit Me').getByTestId('task-edit-btn').click();
    await page.waitForTimeout(200);

    await expect(page.getByTestId('inline-edit-input')).toBeVisible();
  });

  test('inline-edit-save saves the new title', async ({ page }) => {
    await addTask(page, { title: 'Original Title', date: FUTURE_DATE });

    await taskCard(page, 'Original Title').getByTestId('task-edit-btn').click();
    await page.waitForTimeout(200);

    await page.getByTestId('inline-edit-input').fill('Updated Title');
    await page.getByTestId('inline-edit-save').click();
    await page.waitForTimeout(200);

    await expect(page.getByTestId('task-title').getByText('Updated Title', { exact: true })).toBeVisible();
    expect(await page.getByTestId('task-title').getByText('Original Title', { exact: true }).count()).toBe(0);
  });

  test('pressing Enter in inline-edit-input saves', async ({ page }) => {
    await addTask(page, { title: 'Enter Save', date: FUTURE_DATE });

    await taskCard(page, 'Enter Save').getByTestId('task-edit-btn').click();
    await page.waitForTimeout(200);

    await page.getByTestId('inline-edit-input').fill('Enter Saved');
    await page.getByTestId('inline-edit-input').press('Enter');
    await page.waitForTimeout(200);

    await expect(page.getByTestId('task-title').getByText('Enter Saved', { exact: true })).toBeVisible();
  });

  test('inline-edit-cancel discards the edit', async ({ page }) => {
    await addTask(page, { title: 'No Change', date: FUTURE_DATE });

    await taskCard(page, 'No Change').getByTestId('task-edit-btn').click();
    await page.waitForTimeout(200);

    await page.getByTestId('inline-edit-input').fill('Discarded Edit');
    await page.getByTestId('inline-edit-cancel').click();
    await page.waitForTimeout(200);

    await expect(page.getByTestId('task-title').getByText('No Change', { exact: true })).toBeVisible();
    expect(await page.getByTestId('task-title').getByText('Discarded Edit', { exact: true }).count()).toBe(0);
  });

  test('pressing Escape in inline-edit-input discards the edit', async ({ page }) => {
    await addTask(page, { title: 'Escape Me', date: FUTURE_DATE });

    await taskCard(page, 'Escape Me').getByTestId('task-edit-btn').click();
    await page.waitForTimeout(200);

    await page.getByTestId('inline-edit-input').fill('Discarded');
    await page.getByTestId('inline-edit-input').press('Escape');
    await page.waitForTimeout(200);

    await expect(page.getByTestId('task-title').getByText('Escape Me', { exact: true })).toBeVisible();
    expect(await page.getByTestId('task-title').getByText('Discarded', { exact: true }).count()).toBe(0);
  });

  // ─── Delete ───────────────────────────────────────────────────────────────

  test('task-delete-btn removes the task', async ({ page }) => {
    await addTask(page, { title: 'Delete Me', date: FUTURE_DATE });
    await expect(page.getByTestId('task-title').getByText('Delete Me', { exact: true })).toBeVisible();

    await taskCard(page, 'Delete Me').getByTestId('task-delete-btn').click();
    await page.waitForTimeout(300);

    expect(await page.getByTestId('task-title').getByText('Delete Me', { exact: true }).count()).toBe(0);
  });

  test('deleting one task does not remove others', async ({ page }) => {
    await addTask(page, { title: 'Keep Me', date: FUTURE_DATE });
    await addTask(page, { title: 'Remove Me', date: FUTURE_DATE });

    await taskCard(page, 'Remove Me').getByTestId('task-delete-btn').click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId('task-title').getByText('Keep Me', { exact: true })).toBeVisible();
    expect(await page.getByTestId('task-title').getByText('Remove Me', { exact: true }).count()).toBe(0);
  });
});
