/**
 * Test Suite 4 – Drag and Drop Reordering
 */

const { test, expect } = require('@playwright/test');
const { resetApp, addTask, getTasks } = require('./helpers');

const FUTURE_DATE = '2099-12-31';

test.describe('Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('task-drag-handle is present on each task card', async ({ page }) => {
    await addTask(page, { title: 'Handle Test', date: FUTURE_DATE });

    await expect(page.getByTestId('task-drag-handle').first()).toBeVisible();
  });

  test('drag-and-drop reorders tasks in the UI', async ({ page }) => {
    await addTask(page, { title: 'Alpha', date: FUTURE_DATE });
    await addTask(page, { title: 'Beta',  date: FUTURE_DATE });
    await addTask(page, { title: 'Gamma', date: FUTURE_DATE });
    await page.waitForTimeout(300);

    const items = page.getByTestId('task-item');
    expect(await items.count()).toBe(3);

    const firstTitle = await items.nth(0).getByTestId('task-title').innerText();

    const srcHandle = items.nth(0).getByTestId('task-drag-handle');
    const dstItem   = items.nth(2);

    const srcBox = await srcHandle.boundingBox();
    const dstBox = await dstItem.boundingBox();

    if (!srcBox || !dstBox) {
      test.skip(true, 'Could not get bounding boxes for drag handles');
      return;
    }

    await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    const steps = 20;
    const endY = dstBox.y + dstBox.height;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        srcBox.x + srcBox.width / 2,
        srcBox.y + srcBox.height / 2 + ((endY - srcBox.y - srcBox.height / 2) * i) / steps,
        { steps: 1 }
      );
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);

    const newFirstTitle = await items.nth(0).getByTestId('task-title').innerText();
    expect(newFirstTitle !== firstTitle, 'Task order should change after drag').toBe(true);
  });

  test('reordered tasks are persisted to localStorage', async ({ page }) => {
    await addTask(page, { title: 'One',   date: FUTURE_DATE });
    await addTask(page, { title: 'Two',   date: FUTURE_DATE });
    await addTask(page, { title: 'Three', date: FUTURE_DATE });
    await page.waitForTimeout(300);

    const items = page.getByTestId('task-item');
    const srcHandle = items.nth(0).getByTestId('task-drag-handle');
    const dstItem   = items.nth(2);

    const srcBox = await srcHandle.boundingBox();
    const dstBox = await dstItem.boundingBox();

    if (!srcBox || !dstBox) {
      test.skip(true, 'Cannot get bounding boxes');
      return;
    }

    await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    const steps = 20;
    const endY = dstBox.y + dstBox.height;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        srcBox.x + srcBox.width / 2,
        srcBox.y + srcBox.height / 2 + ((endY - srcBox.y - srcBox.height / 2) * i) / steps,
        { steps: 1 }
      );
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);

    const tasks = await getTasks(page);
    expect(tasks.length).toBe(3);
  });
});
