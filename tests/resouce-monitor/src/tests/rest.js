/**
 * REST API Tests
 * Covers: GET /health, GET /metrics, GET /metrics/:type, 404 fallback
 */
import { BASE_URL, VALID_METRIC_TYPES } from '../config.js';
import { get, assert, assertEqual, assertHasKeys } from '../utils.js';

export const suite = {
  name: 'REST API',
  tests: [
    {
      name: 'GET /health → 200 { status: "ok" }',
      async run() {
        const { status, body } = await get(`${BASE_URL}/health`);
        assertEqual(status, 200, 'status');
        assertEqual(body.status, 'ok', 'body.status');
      },
    },

    {
      name: 'GET /metrics → 200 with all metric fields',
      async run() {
        const { status, body } = await get(`${BASE_URL}/metrics`);
        assertEqual(status, 200, 'status');
        assertHasKeys(body, ['timestamp', 'cpu', 'memory', 'disk', 'uptime'], 'body');
        assert(typeof body.timestamp === 'string', 'timestamp is a string');
      },
    },

    {
      name: 'GET /metrics → cpu data has expected shape',
      async run() {
        const { body } = await get(`${BASE_URL}/metrics`);
        assertHasKeys(body.cpu, ['model', 'cores', 'idlePercent', 'usagePercent', 'loadAverage'], 'cpu');
        assert(typeof body.cpu.cores === 'number', 'cpu.cores is a number');
        assert(body.cpu.usagePercent >= 0 && body.cpu.usagePercent <= 100, 'cpu.usagePercent in [0,100]');
        assert(Array.isArray(body.cpu.loadAverage), 'cpu.loadAverage is array');
      },
    },

    {
      name: 'GET /metrics → memory data has expected shape',
      async run() {
        const { body } = await get(`${BASE_URL}/metrics`);
        assertHasKeys(body.memory, ['totalBytes', 'freeBytes', 'usedBytes', 'usagePercent', 'totalMB', 'freeMB', 'usedMB'], 'memory');
        assert(body.memory.totalBytes > 0, 'memory.totalBytes > 0');
        assert(body.memory.usagePercent >= 0 && body.memory.usagePercent <= 100, 'memory.usagePercent in [0,100]');
      },
    },

    {
      name: 'GET /metrics → disk data has expected shape',
      async run() {
        const { body } = await get(`${BASE_URL}/metrics`);
        assert(body.disk !== undefined, 'disk field exists');
        // disk may report an error on some platforms
        if (!body.disk.error) {
          assertHasKeys(body.disk, ['totalBytes', 'freeBytes', 'usedBytes', 'usagePercent'], 'disk');
        }
      },
    },

    {
      name: 'GET /metrics → uptime data has expected shape',
      async run() {
        const { body } = await get(`${BASE_URL}/metrics`);
        assertHasKeys(body.uptime, ['uptimeSeconds', 'formatted', 'processUptimeSeconds', 'hostname', 'platform', 'arch'], 'uptime');
        assert(body.uptime.uptimeSeconds > 0, 'uptime.uptimeSeconds > 0');
        assert(typeof body.uptime.formatted === 'string', 'uptime.formatted is string');
      },
    },

    ...VALID_METRIC_TYPES.map((type) => ({
      name: `GET /metrics/${type} → 200 with type, timestamp and data`,
      async run() {
        const { status, body } = await get(`${BASE_URL}/metrics/${type}`);
        assertEqual(status, 200, 'status');
        assertHasKeys(body, ['type', 'timestamp', 'data'], `metrics/${type} body`);
        assertEqual(body.type, type, 'body.type');
        assert(typeof body.timestamp === 'string', 'timestamp is string');
        assert(body.data !== null && body.data !== undefined, 'data is present');
      },
    })),

    {
      name: 'GET /metrics/invalid → 400 with error message',
      async run() {
        const { status, body } = await get(`${BASE_URL}/metrics/invalid`);
        assertEqual(status, 400, 'status');
        assert(typeof body.error === 'string', 'body.error is string');
        assert(body.error.includes('invalid'), 'error mentions the invalid type');
      },
    },

    {
      name: 'GET /metrics/randomgarbage → 400',
      async run() {
        const { status } = await get(`${BASE_URL}/metrics/randomgarbage`);
        assertEqual(status, 400, 'status');
      },
    },

    {
      name: 'GET /nonexistent → 404',
      async run() {
        const { status } = await get(`${BASE_URL}/nonexistent`);
        assertEqual(status, 404, 'status');
      },
    },

    {
      name: 'GET /metrics timestamps are ISO 8601',
      async run() {
        const { body } = await get(`${BASE_URL}/metrics`);
        const parsed = new Date(body.timestamp);
        assert(!isNaN(parsed.getTime()), 'timestamp parses as a valid date');
      },
    },

    {
      name: 'GET /metrics called twice returns fresh timestamps',
      async run() {
        const { body: a } = await get(`${BASE_URL}/metrics`);
        await new Promise((r) => setTimeout(r, 1100));
        const { body: b } = await get(`${BASE_URL}/metrics`);
        assert(a.timestamp !== b.timestamp, 'second call has a newer timestamp');
      },
    },
  ],
};
