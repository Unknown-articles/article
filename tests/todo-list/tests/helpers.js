/**
 * Shared helpers for Todo List E2E tests.
 *
 * All selectors use data-testid attributes as specified in prompt.md TESTABILITY section.
 * localStorage key: "tasks" (JSON array of task objects).
 */

const BASE_URL = 'http://localhost:5173';

/**
 * Navigate to the app and clear localStorage so each test starts clean.
 * @param {import('@playwright/test').Page} page
 */
async function resetApp(page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.removeItem('tasks'));
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Add a task using the TaskForm at the top of the page.
 * @param {import('@playwright/test').Page} page
 * @param {{ title: string, date?: string }} task
 */
async function addTask(page, { title, date }) {
  await page.getByTestId('task-input').fill(title);
  if (date) {
    await page.getByTestId('task-date-input').fill(date);
  }
  await page.getByTestId('task-submit').click();
  await page.waitForTimeout(200);
}

/**
 * Return a locator for a task card that contains the given title (exact match).
 * Scopes to [data-testid="task-title"] to avoid matching the action log.
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
function taskCard(page, title) {
  return page
    .getByTestId('task-item')
    .filter({ has: page.getByTestId('task-title').getByText(title, { exact: true }) })
    .first();
}

/**
 * Return the tasks array from localStorage.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array>}
 */
async function getTasks(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('tasks')) ?? [];
    } catch {
      return [];
    }
  });
}

module.exports = { resetApp, addTask, taskCard, getTasks, BASE_URL };
