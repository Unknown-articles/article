/**
 * Test Suite 5 – Mobile-Friendly Gestures
 */

const { test, expect } = require('@playwright/test');
const { resetApp, addTask, taskCard } = require('./helpers');

const FUTURE_DATE = '2099-12-31';

test.describe('Mobile Gestures', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('UI has no horizontal scroll on mobile viewport', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('tap/click on task-checkbox completes the task', async ({ page }) => {
    await addTask(page, { title: 'Tap Complete', date: FUTURE_DATE });

    const card = taskCard(page, 'Tap Complete');
    const checkbox = card.getByTestId('task-checkbox');

    const isTouchEnabled = await page.evaluate(() => navigator.maxTouchPoints > 0);
    if (isTouchEnabled) {
      await checkbox.tap();
    } else {
      await checkbox.click();
    }
    await page.waitForTimeout(300);

    await expect(card).toHaveAttribute('data-completed', 'true');
  });

  test('swipe left on task-item-wrapper deletes the task', async ({ page }) => {
    const title = 'Swipe Delete';
    await addTask(page, { title, date: FUTURE_DATE });
    await expect(page.getByTestId('task-title').getByText(title, { exact: true })).toBeVisible();

    const wrapper = page.getByTestId('task-item-wrapper')
      .filter({ has: page.getByTestId('task-title').getByText(title, { exact: true }) })
      .first();

    const box = await wrapper.boundingBox();
    if (!box) {
      test.skip(true, 'Could not get bounding box for swipe');
      return;
    }

    const startX = box.x + box.width * 0.75;
    const endX   = box.x + box.width * 0.05;
    const midY   = box.y + box.height / 2;

    await page.evaluate(
      ({ startX, midY, endX }) => {
        const el = document.elementFromPoint(startX, midY);
        if (!el) return;

        const makeTouches = (x, y) => [
          new Touch({ identifier: 1, target: el, clientX: x, clientY: y,
                      screenX: x, screenY: y, pageX: x, pageY: y }),
        ];

        el.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true, cancelable: true,
          touches: makeTouches(startX, midY),
          changedTouches: makeTouches(startX, midY),
        }));

        const steps = 15;
        for (let i = 1; i <= steps; i++) {
          const x = startX + ((endX - startX) * i) / steps;
          el.dispatchEvent(new TouchEvent('touchmove', {
            bubbles: true, cancelable: true,
            touches: makeTouches(x, midY),
            changedTouches: makeTouches(x, midY),
          }));
        }

        el.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true, cancelable: true,
          touches: [],
          changedTouches: makeTouches(endX, midY),
        }));
      },
      { startX, midY, endX }
    );

    await page.waitForTimeout(800);

    expect(
      await page.getByTestId('task-title').getByText(title, { exact: true }).count()
    ).toBe(0);
  });

  test('task-checkbox has aria-checked="true" after completion', async ({ page }) => {
    await addTask(page, { title: 'Aria Mobile', date: FUTURE_DATE });

    const card = taskCard(page, 'Aria Mobile');
    await card.getByTestId('task-checkbox').click();
    await page.waitForTimeout(200);

    await expect(card.getByTestId('task-checkbox')).toHaveAttribute('aria-checked', 'true');
  });
});
