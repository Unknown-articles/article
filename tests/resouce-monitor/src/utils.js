import { WS_TIMEOUT_MS } from './config.js';

// ─── HTTP helpers ───────────────────────────────────────────────────────────

export async function get(url) {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

// ─── WebSocket helpers ──────────────────────────────────────────────────────

/**
 * Open a WebSocket connection and resolve with the first message received.
 * Rejects if the timeout elapses before any message arrives.
 */
export function wsFirstMessage(url, timeoutMs = WS_TIMEOUT_MS) {
  return new Promise(async (resolve, reject) => {
    const { WebSocket } = await import('ws');
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout waiting for first message from ${url}`));
    }, timeoutMs);

    ws.on('message', (raw) => {
      clearTimeout(timer);
      ws.close();
      try {
        resolve(JSON.parse(raw.toString()));
      } catch {
        resolve(raw.toString());
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Open a WebSocket, send a message, collect the next N messages,
 * then close. Resolves with the array of parsed messages.
 */
export function wsCollect(url, sendPayload = null, count = 1, timeoutMs = WS_TIMEOUT_MS) {
  return new Promise(async (resolve, reject) => {
    const { WebSocket } = await import('ws');
    const ws = new WebSocket(url);
    const messages = [];

    const timer = setTimeout(() => {
      ws.close();
      // Resolve with whatever we collected rather than rejecting,
      // so callers can assert on partial results.
      resolve(messages);
    }, timeoutMs);

    ws.on('open', () => {
      if (sendPayload !== null) {
        ws.send(JSON.stringify(sendPayload));
      }
    });

    ws.on('message', (raw) => {
      try {
        messages.push(JSON.parse(raw.toString()));
      } catch {
        messages.push(raw.toString());
      }
      if (messages.length >= count) {
        clearTimeout(timer);
        ws.close();
        resolve(messages);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Connect two WebSocket clients simultaneously and collect one broadcast
 * message each (after the welcome message). Resolves with [msg1, msg2].
 */
export function wsDualCollect(url, timeoutMs = WS_TIMEOUT_MS) {
  return new Promise(async (resolve, reject) => {
    const { WebSocket } = await import('ws');
    const results = [null, null];
    let done = 0;

    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for dual WS broadcast'));
    }, timeoutMs);

    function makeClient(index) {
      const ws = new WebSocket(url);
      let firstSkipped = false;

      ws.on('message', (raw) => {
        // Skip the welcome message
        if (!firstSkipped) { firstSkipped = true; return; }
        try {
          results[index] = JSON.parse(raw.toString());
        } catch {
          results[index] = raw.toString();
        }
        ws.close();
        done++;
        if (done === 2) {
          clearTimeout(timer);
          resolve(results);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    }

    makeClient(0);
    makeClient(1);
  });
}

// ─── Assertion / reporting helpers ──────────────────────────────────────────

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertHasKeys(obj, keys, label) {
  for (const key of keys) {
    if (!(key in obj)) {
      throw new Error(`${label}: missing key "${key}" in ${JSON.stringify(obj)}`);
    }
  }
}
