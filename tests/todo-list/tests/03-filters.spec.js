/**
 * Test Suite 3 – Filters
 */

const { test, expect } = require('@playwright/test');
const { resetApp, addTask, taskCard } = require('./helpers');

const PAST_DATE   = '2020-01-01';
const FUTURE_DATE = '2099-12-31';

async function clickFilter(page, testId) {
  await page.getByTestId(testId).click();
  await page.waitForTimeout(200);
}

test.describe('Filters', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('all four filter buttons have correct data-testid attributes', async ({ page }) => {
    for (const id of ['filter-all', 'filter-pending', 'filter-completed', 'filter-late']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test('filter buttons use aria-pressed to reflect active state', async ({ page }) => {
    // "all" is active by default
    await expect(page.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('filter-pending')).toHaveAttribute('aria-pressed', 'false');

    await clickFilter(page, 'filter-pending');
    await expect(page.getByTestId('filter-pending')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'false');
  });

  test('filter count badges have correct data-testid attributes', async ({ page }) => {
    await addTask(page, { title: 'Count Task', date: FUTURE_DATE });

    for (const id of ['filter-count-all', 'filter-count-pending', 'filter-count-completed', 'filter-count-late']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test('"All" filter count equals total tasks', async ({ page }) => {
    await addTask(page, { title: 'One', date: FUTURE_DATE });
    await addTask(page, { title: 'Two', date: FUTURE_DATE });

    const count = await page.getByTestId('filter-count-all').innerText();
    expect(Number(count)).toBe(2);
  });

  test('"filter-all" shows all tasks', async ({ page }) => {
    await addTask(page, { title: 'Task One', date: FUTURE_DATE });
    await addTask(page, { title: 'Task Two', date: FUTURE_DATE });

    await taskCard(page, 'Task Two').getByTestId('task-checkbox').click();
    await page.waitForTimeout(200);

    await clickFilter(page, 'filter-all');
    expect(await page.getByTestId('task-item').count()).toBe(2);
  });

  test('"filter-completed" shows only completed tasks', async ({ page }) => {
    await addTask(page, { title: 'DoneTask', date: FUTURE_DATE });
    await addTask(page, { title: 'NotDoneTask', date: FUTURE_DATE });

    await taskCard(page, 'DoneTask').getByTestId('task-checkbox').click();
    await page.waitForTimeout(200);

    await clickFilter(page, 'filter-completed');

    await expect(page.getByTestId('task-title').getByText('DoneTask', { exact: true })).toBeVisible();
    expect(await page.getByTestId('task-title').getByText('NotDoneTask', { exact: true }).count()).toBe(0);
  });

  test('"filter-pending" shows only non-late incomplete tasks', async ({ page }) => {
    await addTask(page, { title: 'FuturePending', date: FUTURE_DATE });
    await addTask(page, { title: 'Finished', date: FUTURE_DATE });

    await taskCard(page, 'Finished').getByTestId('task-checkbox').click();
    await page.waitForTimeout(200);

    await clickFilter(page, 'filter-pending');

    await expect(page.getByTestId('task-title').getByText('FuturePending', { exact: true })).toBeVisible();
    expect(await page.getByTestId('task-title').getByText('Finished', { exact: true }).count()).toBe(0);
  });

  test('"filter-late" shows only overdue incomplete tasks', async ({ page }) => {
    await addTask(page, { title: 'Overdue', date: PAST_DATE });
    await addTask(page, { title: 'Future', date: FUTURE_DATE });

    await clickFilter(page, 'filter-late');

    await expect(page.getByTestId('task-title').getByText('Overdue', { exact: true })).toBeVisible();
    expect(await page.getByTestId('task-title').getByText('Future', { exact: true }).count()).toBe(0);
  });

  test('completed overdue task does NOT appear in "filter-late"', async ({ page }) => {
    await addTask(page, { title: 'DoneOverdue', date: PAST_DATE });
    await taskCard(page, 'DoneOverdue').getByTestId('task-checkbox').click();
    await page.waitForTimeout(200);

    await clickFilter(page, 'filter-late');
    expect(await page.getByTestId('task-title').getByText('DoneOverdue', { exact: true }).count()).toBe(0);
  });

  test('filter-count-all updates dynamically after adding a task', async ({ page }) => {
    const before = Number(await page.getByTestId('filter-count-all').innerText());

    await addTask(page, { title: 'Dynamic', date: FUTURE_DATE });

    const after = Number(await page.getByTestId('filter-count-all').innerText());
    expect(after).toBe(before + 1);
  });
});
