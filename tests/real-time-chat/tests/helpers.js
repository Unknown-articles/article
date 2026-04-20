/**
 * Shared helpers for Real-Time Chat E2E tests.
 *
 * Frontend selectors use data-testid attributes as defined in prompt.md TESTABILITY section.
 * localStorage keys: "chat_token" (JWT) and "chat_user" (JSON { userId, username }).
 * Backend base URL: http://localhost:3000
 * Frontend base URL: http://localhost:5173
 */

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL  = 'http://localhost:3000';
const WS_URL       = 'ws://localhost:3000';

/**
 * Generate a unique username that will not collide between test runs.
 * The backend DB persists users, so every test that registers must use a unique name.
 */
function uniqueUser() {
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 5);
  return `u_${ts}${rand}`;   // e.g. "u_lz1k2abc"  (always > 3 chars)
}

/**
 * Navigate to the frontend, wipe auth from localStorage, and reload so the
 * app starts on the AuthForm with a clean state.
 * @param {import('@playwright/test').Page} page
 */
async function resetApp(page) {
  await page.goto(FRONTEND_URL);
  await page.evaluate(() => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Call POST /auth/register directly (bypasses the UI).
 * Returns { token, userId, username } on success, throws on failure.
 */
async function apiRegister(username, password) {
  const res = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Register failed: ${res.status}`);
  return body;
}

/**
 * Call POST /auth/login directly (bypasses the UI).
 * Returns { token, userId, username } on success, throws on failure.
 */
async function apiLogin(username, password) {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Login failed: ${res.status}`);
  return body;
}

/**
 * Register a new user via API and immediately log in via the UI,
 * leaving the page on the chat screen.
 * Returns { username, password, token, userId }
 * @param {import('@playwright/test').Page} page
 */
async function registerAndLoginViaUI(page, username, password) {
  await resetApp(page);

  // Switch to Register tab
  await page.getByTestId('tab-register').click();
  await page.waitForTimeout(100);

  await page.getByTestId('input-username').fill(username);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-submit').click();

  // Wait until chat-container is visible (auth succeeded)
  await page.getByTestId('chat-container').waitFor({ state: 'visible', timeout: 8_000 });
}

/**
 * Log in via the UI using an already-registered account.
 * @param {import('@playwright/test').Page} page
 */
async function loginViaUI(page, username, password) {
  await resetApp(page);

  // Login tab is active by default
  await page.getByTestId('input-username').fill(username);
  await page.getByTestId('input-password').fill(password);
  await page.getByTestId('btn-submit').click();

  await page.getByTestId('chat-container').waitFor({ state: 'visible', timeout: 8_000 });
}

/**
 * Wait until the connection-status element reports data-connected="true".
 * @param {import('@playwright/test').Page} page
 */
async function waitForConnected(page, timeout = 10_000) {
  await page.getByTestId('connection-status').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="connection-status"]')
                  ?.getAttribute('data-connected') === 'true',
    { timeout }
  );
}

/**
 * Open a WebSocket connection (Node.js built-in, available in Node 22+).
 * Resolves with { ws, firstMessage } where firstMessage is the "history" event.
 * Rejects after `timeout` ms.
 */
function openWebSocket(token, timeout = 6_000) {
  return new Promise((resolve, reject) => {
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;
    const ws  = new WebSocket(url);
    const messages = [];

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, timeout);

    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve({ ws, messages });
    });

    ws.addEventListener('message', (evt) => {
      try { messages.push(JSON.parse(evt.data)); } catch {}
    });

    ws.addEventListener('error', () => {
      clearTimeout(timer);
      // Don't reject on error — close event will follow with the code
    });
  });
}

/**
 * Wait until the messages array has at least `count` items.
 */
function waitForMessages(messages, count, timeout = 5_000) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (messages.length >= count) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Expected ${count} WS messages, got ${messages.length}`));
    }, timeout);
  });
}

/**
 * Collect the close event from a WebSocket (for testing rejection codes).
 */
function awaitClose(url, timeout = 5_000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket close timeout'));
    }, timeout);

    ws.addEventListener('close', (evt) => {
      clearTimeout(timer);
      resolve({ code: evt.code, reason: evt.reason });
    });

    ws.addEventListener('error', () => {}); // suppressed — close will follow
  });
}

module.exports = {
  FRONTEND_URL,
  BACKEND_URL,
  WS_URL,
  uniqueUser,
  resetApp,
  apiRegister,
  apiLogin,
  registerAndLoginViaUI,
  loginViaUI,
  waitForConnected,
  openWebSocket,
  waitForMessages,
  awaitClose,
};
