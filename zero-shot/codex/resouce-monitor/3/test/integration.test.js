import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';

const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}`;

let serverProcess;

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start in time')), 5000);

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes(`listening on port ${PORT}`)) {
        clearTimeout(timer);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      reject(new Error(data.toString()));
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function openWebSocket(path) {
  const ws = new WebSocket(`${WS_URL}${path}`);
  const messages = [];
  const waiters = [];

  ws.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    const waiter = waiters.shift();
    if (waiter) {
      waiter.resolve(parsed);
    } else {
      messages.push(parsed);
    }
  });

  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  ws.nextMessage = () => {
    if (messages.length > 0) {
      return Promise.resolve(messages.shift());
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = waiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('Timed out waiting for WebSocket message'));
      }, 3000);

      waiters.push({
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        }
      });
    });
  };

  return ws;
}

before(async () => {
  serverProcess = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await waitForServer();
});

after(() => {
  serverProcess?.kill();
});

test('GET /health returns ok JSON', async () => {
  const response = await fetch(`${BASE_URL}/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('GET /metrics returns cached snapshot with expected shape', async () => {
  const first = await fetch(`${BASE_URL}/metrics`).then((response) => response.json());
  await wait(1100);
  const second = await fetch(`${BASE_URL}/metrics`).then((response) => response.json());

  assert.notEqual(first.timestamp, second.timestamp);
  assert.deepEqual(Object.keys(second.cpu).sort(), ['cores', 'idlePercent', 'loadAverage', 'model', 'usagePercent'].sort());
  assert.deepEqual(
    Object.keys(second.memory).sort(),
    ['freeBytes', 'freeMB', 'totalBytes', 'totalMB', 'usagePercent', 'usedBytes', 'usedMB'].sort()
  );
  assert.ok('error' in second.disk || Object.keys(second.disk).sort().join(',') === 'freeBytes,totalBytes,usagePercent,usedBytes');
  assert.deepEqual(
    Object.keys(second.uptime).sort(),
    ['arch', 'formatted', 'hostname', 'platform', 'processUptimeSeconds', 'uptimeSeconds'].sort()
  );
});

test('GET /metrics/:type validates requested type', async () => {
  const valid = await fetch(`${BASE_URL}/metrics/cpu`);
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).type, 'cpu');

  const invalid = await fetch(`${BASE_URL}/metrics/anything-invalid`);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /anything-invalid/);
});

test('unknown REST routes return JSON 404', async () => {
  const response = await fetch(`${BASE_URL}/unknown-route`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /^application\/json/);
});

test('path WebSocket subscriptions receive only subscribed metrics', async () => {
  const ws = await openWebSocket('/ws/cpu');
  const welcome = await ws.nextMessage();
  const snapshot = await ws.nextMessage();

  assert.deepEqual(welcome.subscribedTo, ['cpu']);
  assert.deepEqual(Object.keys(snapshot).sort(), ['cpu', 'timestamp'].sort());
  ws.close();
});

test('base WebSocket supports dynamic subscribe and errors', async () => {
  const ws = await openWebSocket('/ws');
  const welcome = await ws.nextMessage();
  assert.deepEqual(welcome.subscribedTo, []);

  ws.send(JSON.stringify({ action: 'subscribe', metrics: ['memory', 'disk'] }));
  const ack = await ws.nextMessage();
  const snapshot = await ws.nextMessage();
  assert.equal(ack.event, 'ack');
  assert.deepEqual(ack.metrics, ['memory', 'disk']);
  assert.deepEqual(Object.keys(snapshot).sort(), ['disk', 'memory', 'timestamp'].sort());

  ws.send(JSON.stringify({ action: 'subscribe', metrics: ['unknown'] }));
  const error = await ws.nextMessage();
  assert.equal(error.event, 'error');
  assert.match(error.message, /unknown/);
  ws.close();
});

test('multiple /ws/all clients receive the same cached snapshot', async () => {
  const first = await openWebSocket('/ws/all');
  const second = await openWebSocket('/ws/all');

  await first.nextMessage();
  await second.nextMessage();
  const firstSnapshot = await first.nextMessage();
  const secondSnapshot = await second.nextMessage();

  assert.equal(firstSnapshot.timestamp, secondSnapshot.timestamp);
  assert.deepEqual(Object.keys(firstSnapshot).sort(), ['cpu', 'disk', 'memory', 'timestamp', 'uptime'].sort());

  first.close();
  second.close();
});
