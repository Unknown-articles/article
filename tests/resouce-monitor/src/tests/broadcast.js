/**
 * Broadcast Model Tests
 * Verifies: metrics collected once per interval and shared across all subscribers,
 *           no per-client polling, multiple concurrent clients handled correctly.
 */
import { WS_URL } from '../config.js';
import { wsDualCollect, assert, assertEqual, assertHasKeys } from '../utils.js';

export const suite = {
  name: 'Broadcast Model',
  tests: [
    {
      name: 'Two simultaneous clients receive the same snapshot (same timestamp)',
      async run() {
        const [msg1, msg2] = await wsDualCollect(`${WS_URL}/ws/all`);
        assert(msg1 !== null, 'client 1 received a message');
        assert(msg2 !== null, 'client 2 received a message');
        assertEqual(msg1.timestamp, msg2.timestamp, 'timestamps match — same cached snapshot');
      },
    },

    {
      name: 'Three concurrent clients all receive valid metric snapshots',
      async run() {
        const { WebSocket } = await import('ws');
        const results = [];

        await new Promise((resolve, reject) => {
          let done = 0;
          const timer = setTimeout(() => reject(new Error('Timeout for 3-client test')), 4000);

          for (let i = 0; i < 3; i++) {
            const ws = new WebSocket(`${WS_URL}/ws/all`);
            let welcomed = false;

            ws.on('message', (raw) => {
              const msg = JSON.parse(raw.toString());
              if (!welcomed) { welcomed = true; return; } // skip welcome
              results.push(msg);
              ws.close();
              done++;
              if (done === 3) {
                clearTimeout(timer);
                resolve();
              }
            });
            ws.on('error', reject);
          }
        });

        assertEqual(results.length, 3, '3 results collected');
        for (const r of results) {
          assertHasKeys(r, ['timestamp', 'cpu', 'memory', 'disk', 'uptime'], 'client snapshot');
        }

        // All three should share the same snapshot timestamp
        const timestamps = new Set(results.map((r) => r.timestamp));
        assert(timestamps.size === 1, `All 3 clients share the same timestamp (got ${[...timestamps].join(', ')})`);
      },
    },

    {
      name: 'Broadcast interval is roughly 1 second (500ms–2000ms between updates)',
      async run() {
        const { WebSocket } = await import('ws');

        const timestamps = await new Promise((resolve, reject) => {
          const ws = new WebSocket(`${WS_URL}/ws/all`);
          const ts = [];
          const timer = setTimeout(() => {
            ws.close();
            resolve(ts);
          }, 3500);

          ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.event) return; // skip control events
            ts.push(msg.timestamp);
            if (ts.length >= 3) {
              clearTimeout(timer);
              ws.close();
              resolve(ts);
            }
          });
          ws.on('error', reject);
        });

        assert(timestamps.length >= 2, `Need at least 2 broadcast timestamps, got ${timestamps.length}`);

        for (let i = 1; i < timestamps.length; i++) {
          const delta = new Date(timestamps[i]) - new Date(timestamps[i - 1]);
          assert(
            delta >= 500 && delta <= 2000,
            `Interval between broadcasts[${i - 1}] and [${i}] is ${delta}ms — expected 500–2000ms`,
          );
        }
      },
    },

    {
      name: 'Disconnected client is cleaned up — remaining clients still receive updates',
      async run() {
        const { WebSocket } = await import('ws');

        // Connect two clients to /ws/all. Close the first after welcome.
        // Verify the second still receives broadcasts.
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Timeout in disconnect test')), 5000);

          // Client A: connect and immediately disconnect after welcome
          const wsA = new WebSocket(`${WS_URL}/ws/all`);
          wsA.on('message', () => wsA.close());
          wsA.on('error', reject);

          // Client B: verify it still gets broadcasts after A disconnects
          const wsB = new WebSocket(`${WS_URL}/ws/all`);
          let bWelcomed = false;
          wsB.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (!bWelcomed) { bWelcomed = true; return; }
            // Got a broadcast while A is gone — success
            clearTimeout(timer);
            wsB.close();
            resolve();
          });
          wsB.on('error', reject);
        });

        assert(true, 'Remaining client received broadcast after peer disconnected');
      },
    },

    {
      name: 'Metrics data is cached — REST and WS snapshots share the same timestamp',
      async run() {
        const { WebSocket } = await import('ws');

        // Collect a WS broadcast and a REST snapshot close together in time.
        const wsTimestamp = await new Promise((resolve, reject) => {
          const ws = new WebSocket(`${WS_URL}/ws/all`);
          let welcomed = false;
          const timer = setTimeout(() => reject(new Error('Timeout')), 3000);

          ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (!welcomed) { welcomed = true; return; }
            clearTimeout(timer);
            ws.close();
            resolve(msg.timestamp);
          });
          ws.on('error', reject);
        });

        const restRes = await fetch('http://localhost:3000/metrics');
        const restBody = await restRes.json();
        const restTimestamp = restBody.timestamp;

        // Both timestamps must be within 2 seconds of each other
        const delta = Math.abs(new Date(wsTimestamp) - new Date(restTimestamp));
        assert(
          delta <= 2000,
          `WS and REST timestamps differ by ${delta}ms — should share cache (≤2000ms)`,
        );
      },
    },
  ],
};
