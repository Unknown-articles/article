/**
 * WebSocket Tests
 * Covers: path-based subscriptions, dynamic subscribe/unsubscribe,
 *         multiple subscriptions, payload filtering, error handling.
 */
import { WS_URL, ALL_TYPES } from '../config.js';
import { wsFirstMessage, wsCollect, assert, assertEqual, assertHasKeys } from '../utils.js';

export const suite = {
  name: 'WebSocket',
  tests: [
    // ── Connection & welcome ─────────────────────────────────────────────────
    {
      name: 'Connect /ws → receive "connected" welcome event',
      async run() {
        const msg = await wsFirstMessage(`${WS_URL}/ws`);
        assertEqual(msg.event, 'connected', 'event');
        assert(Array.isArray(msg.subscribedTo), 'subscribedTo is array');
        assert(Array.isArray(msg.validTypes), 'validTypes is array');
      },
    },

    {
      name: 'Welcome message lists all valid types',
      async run() {
        const msg = await wsFirstMessage(`${WS_URL}/ws`);
        for (const t of ALL_TYPES) {
          assert(msg.validTypes.includes(t), `validTypes includes "${t}"`);
        }
      },
    },

    {
      name: 'Connect /ws with no path → subscribedTo is empty',
      async run() {
        const msg = await wsFirstMessage(`${WS_URL}/ws`);
        assertEqual(msg.subscribedTo.length, 0, 'subscribedTo length');
      },
    },

    // ── Path-based subscriptions ─────────────────────────────────────────────
    {
      name: 'Connect /ws/cpu → welcome shows subscribedTo ["cpu"] and immediate data',
      async run() {
        // Expect: welcome + immediate snapshot (2 messages)
        const msgs = await wsCollect(`${WS_URL}/ws/cpu`, null, 2);
        const welcome = msgs[0];
        assertEqual(welcome.event, 'connected', 'event');
        assert(welcome.subscribedTo.includes('cpu'), 'subscribedTo includes cpu');

        const snapshot = msgs[1];
        assertHasKeys(snapshot, ['timestamp', 'cpu'], 'cpu snapshot');
        assert(!('memory' in snapshot), 'cpu snapshot does NOT include memory');
      },
    },

    {
      name: 'Connect /ws/memory → welcome + immediate memory-only snapshot',
      async run() {
        const msgs = await wsCollect(`${WS_URL}/ws/memory`, null, 2);
        const snapshot = msgs[1];
        assertHasKeys(snapshot, ['timestamp', 'memory'], 'memory snapshot');
        assert(!('cpu' in snapshot), 'memory snapshot does NOT include cpu');
      },
    },

    {
      name: 'Connect /ws/disk → welcome + immediate disk-only snapshot',
      async run() {
        const msgs = await wsCollect(`${WS_URL}/ws/disk`, null, 2);
        const snapshot = msgs[1];
        assertHasKeys(snapshot, ['timestamp', 'disk'], 'disk snapshot');
        assert(!('cpu' in snapshot), 'disk snapshot does NOT include cpu');
      },
    },

    {
      name: 'Connect /ws/uptime → welcome + immediate uptime-only snapshot',
      async run() {
        const msgs = await wsCollect(`${WS_URL}/ws/uptime`, null, 2);
        const snapshot = msgs[1];
        assertHasKeys(snapshot, ['timestamp', 'uptime'], 'uptime snapshot');
        assert(!('cpu' in snapshot), 'uptime snapshot does NOT include cpu');
      },
    },

    {
      name: 'Connect /ws/all → welcome + immediate full snapshot',
      async run() {
        const msgs = await wsCollect(`${WS_URL}/ws/all`, null, 2);
        const snapshot = msgs[1];
        assertHasKeys(snapshot, ['timestamp', 'cpu', 'memory', 'disk', 'uptime'], 'all snapshot');
      },
    },

    // ── Dynamic subscribe ────────────────────────────────────────────────────
    {
      name: 'Dynamic subscribe → receive ack with correct fields',
      async run() {
        // messages: [welcome, ack, snapshot]
        const msgs = await wsCollect(
          `${WS_URL}/ws`,
          { action: 'subscribe', metrics: ['cpu'] },
          3,
        );
        const ack = msgs[1];
        assertEqual(ack.event, 'ack', 'ack event');
        assertEqual(ack.action, 'subscribe', 'ack action');
        assert(Array.isArray(ack.metrics), 'ack.metrics is array');
        assert(ack.metrics.includes('cpu'), 'ack.metrics includes cpu');
        assert(ack.subscribedTo.includes('cpu'), 'ack.subscribedTo includes cpu');
      },
    },

    {
      name: 'Dynamic subscribe → receive immediate snapshot after ack',
      async run() {
        const msgs = await wsCollect(
          `${WS_URL}/ws`,
          { action: 'subscribe', metrics: ['memory'] },
          3,
        );
        // msgs[0]=welcome, msgs[1]=ack, msgs[2]=snapshot
        const snapshot = msgs[2];
        assertHasKeys(snapshot, ['timestamp', 'memory'], 'memory snapshot after subscribe');
        assert(!('cpu' in snapshot), 'snapshot only has subscribed type');
      },
    },

    {
      name: 'Subscribe to multiple metrics at once → snapshot has all of them',
      async run() {
        const msgs = await wsCollect(
          `${WS_URL}/ws`,
          { action: 'subscribe', metrics: ['cpu', 'memory'] },
          3,
        );
        const snapshot = msgs[2];
        assertHasKeys(snapshot, ['timestamp', 'cpu', 'memory'], 'multi-metric snapshot');
        assert(!('disk' in snapshot), 'snapshot does NOT include non-subscribed disk');
      },
    },

    // ── Dynamic unsubscribe ──────────────────────────────────────────────────
    {
      name: 'Unsubscribe removes type from subscribedTo',
      async run() {
        const { WebSocket } = await import('ws');
        const ws = new WebSocket(`${WS_URL}/ws/cpu`);

        const messages = await new Promise((resolve, reject) => {
          const collected = [];
          const timer = setTimeout(() => resolve(collected), 3000);

          ws.on('message', (raw) => {
            collected.push(JSON.parse(raw.toString()));
            if (collected.length === 1) {
              // After welcome, subscribe then unsubscribe
              ws.send(JSON.stringify({ action: 'unsubscribe', metrics: ['cpu'] }));
            }
            if (collected.length === 2) {
              clearTimeout(timer);
              ws.close();
              resolve(collected);
            }
          });
          ws.on('error', reject);
        });

        const ack = messages[1];
        assertEqual(ack.event, 'ack', 'ack event');
        assertEqual(ack.action, 'unsubscribe', 'ack action');
        assert(!ack.subscribedTo.includes('cpu'), 'cpu removed from subscribedTo');
      },
    },

    // ── Error handling ───────────────────────────────────────────────────────
    {
      name: 'Invalid JSON → error event',
      async run() {
        const { WebSocket } = await import('ws');
        const ws = new WebSocket(`${WS_URL}/ws`);

        const errorMsg = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Timeout')), 3000);
          ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.event === 'error') {
              clearTimeout(timer);
              ws.close();
              resolve(msg);
            }
          });
          ws.on('open', () => ws.send('not valid json {{{{'));
          ws.on('error', reject);
        });

        assertEqual(errorMsg.event, 'error', 'error event');
        assert(typeof errorMsg.message === 'string', 'error message is string');
      },
    },

    {
      name: 'Invalid action → error event',
      async run() {
        const { WebSocket } = await import('ws');
        const ws = new WebSocket(`${WS_URL}/ws`);

        const errorMsg = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Timeout')), 3000);
          ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.event === 'error') {
              clearTimeout(timer);
              ws.close();
              resolve(msg);
            }
          });
          ws.on('open', () =>
            ws.send(JSON.stringify({ action: 'badaction', metrics: ['cpu'] }))
          );
          ws.on('error', reject);
        });

        assertEqual(errorMsg.event, 'error', 'error event');
      },
    },

    {
      name: 'Unknown metric type → error event',
      async run() {
        const { WebSocket } = await import('ws');
        const ws = new WebSocket(`${WS_URL}/ws`);

        const errorMsg = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Timeout')), 3000);
          ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.event === 'error') {
              clearTimeout(timer);
              ws.close();
              resolve(msg);
            }
          });
          ws.on('open', () =>
            ws.send(JSON.stringify({ action: 'subscribe', metrics: ['nonexistent'] }))
          );
          ws.on('error', reject);
        });

        assertEqual(errorMsg.event, 'error', 'error event');
        assert(errorMsg.message.includes('nonexistent'), 'error names the unknown type');
      },
    },

    {
      name: 'Empty metrics array → error event',
      async run() {
        const { WebSocket } = await import('ws');
        const ws = new WebSocket(`${WS_URL}/ws`);

        const errorMsg = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Timeout')), 3000);
          ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.event === 'error') {
              clearTimeout(timer);
              ws.close();
              resolve(msg);
            }
          });
          ws.on('open', () =>
            ws.send(JSON.stringify({ action: 'subscribe', metrics: [] }))
          );
          ws.on('error', reject);
        });

        assertEqual(errorMsg.event, 'error', 'error event');
      },
    },

    // ── Streaming continuity ─────────────────────────────────────────────────
    {
      name: 'Connected client receives at least 2 broadcast updates within 3 seconds',
      async run() {
        // welcome + 2 broadcasts = 3 messages. Use /ws/all for simplest streaming.
        const msgs = await wsCollect(`${WS_URL}/ws/all`, null, 3, 3500);
        // msgs[0] = welcome, msgs[1..] = broadcasts
        const broadcasts = msgs.filter((m) => !m.event);
        assert(broadcasts.length >= 2, `Expected ≥2 broadcasts, got ${broadcasts.length}`);
      },
    },

    {
      name: 'Consecutive broadcast snapshots have different timestamps',
      async run() {
        const msgs = await wsCollect(`${WS_URL}/ws/all`, null, 3, 3500);
        const broadcasts = msgs.filter((m) => !m.event);
        assert(broadcasts.length >= 2, 'Need at least 2 broadcasts');
        assert(
          broadcasts[0].timestamp !== broadcasts[1].timestamp,
          'Consecutive broadcasts have different timestamps',
        );
      },
    },
  ],
};
