import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { refreshMetrics, getMetrics, getMetric, METRIC_TYPES } from './metricsCache.js';

const PORT = Number(process.env.PORT) || 3000;
const VALID_WS_PATHS = new Set(['/ws', '/ws/cpu', '/ws/memory', '/ws/disk', '/ws/uptime', '/ws/all']);
const VALID_WS_TYPES = ['all', 'cpu', 'memory', 'disk', 'uptime'];
const AUTO_SUBSCRIBE_MAP = {
  '/ws': [],
  '/ws/cpu': ['cpu'],
  '/ws/memory': ['memory'],
  '/ws/disk': ['disk'],
  '/ws/uptime': ['uptime'],
  '/ws/all': ['cpu', 'memory', 'disk', 'uptime']
};

const app = express();
app.use(express.json());

app.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', (_, res) => {
  res.status(200).json(getMetrics());
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  if (!METRIC_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: ${type}` });
  }
  const current = getMetrics();
  return res.status(200).json({ type, timestamp: current.timestamp, data: current[type] });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

function getPathname(req) {
  if (!req.url) return '/ws';
  try {
    return new URL(req.url, 'http://localhost').pathname;
  } catch {
    return req.url;
  }
}

function sendJson(ws, payload) {
  ws.send(JSON.stringify(payload));
}

function sendWelcome(ws, subscribedTo) {
  sendJson(ws, {
    event: 'connected',
    subscribedTo,
    validTypes: VALID_WS_TYPES
  });
}

function sendAck(ws, action, metrics, subscribedTo) {
  sendJson(ws, {
    event: 'ack',
    action,
    metrics,
    subscribedTo
  });
}

function sendError(ws, message) {
  sendJson(ws, {
    event: 'error',
    message
  });
}

function buildSnapshot(subscriptionTypes) {
  const metrics = getMetrics();
  const payload = { timestamp: metrics.timestamp };
  if (subscriptionTypes.has('all')) {
    payload.cpu = metrics.cpu;
    payload.memory = metrics.memory;
    payload.disk = metrics.disk;
    payload.uptime = metrics.uptime;
    return payload;
  }
  if (subscriptionTypes.has('cpu')) payload.cpu = metrics.cpu;
  if (subscriptionTypes.has('memory')) payload.memory = metrics.memory;
  if (subscriptionTypes.has('disk')) payload.disk = metrics.disk;
  if (subscriptionTypes.has('uptime')) payload.uptime = metrics.uptime;
  return payload;
}

function validateMetricsArray(input) {
  if (!Array.isArray(input)) {
    return { valid: false, message: 'metrics must be an array' };
  }
  if (input.length === 0) {
    return { valid: false, message: 'metrics array must not be empty' };
  }
  const unknown = input.find((item) => typeof item !== 'string' || !VALID_WS_TYPES.includes(item));
  if (unknown) {
    return { valid: false, message: `Unknown metric type: ${unknown}` };
  }
  return { valid: true };
}

function normalizeRequestedMetrics(metrics) {
  if (metrics.includes('all')) {
    return ['cpu', 'memory', 'disk', 'uptime'];
  }
  return Array.from(new Set(metrics));
}

function createSubscriptionSet(initialTypes) {
  return new Set(initialTypes);
}

function handleClientMessage(ws, rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage.toString());
  } catch {
    sendError(ws, 'Invalid JSON');
    return;
  }

  const { action, metrics } = message;
  if (action !== 'subscribe' && action !== 'unsubscribe') {
    sendError(ws, `Unknown action: ${action}`);
    return;
  }

  const validation = validateMetricsArray(metrics);
  if (!validation.valid) {
    sendError(ws, validation.message);
    return;
  }

  const requestedTypes = normalizeRequestedMetrics(metrics);
  const currentSubscriptions = ws.subscriptions;
  const changedTypes = [];

  if (action === 'subscribe') {
    requestedTypes.forEach((type) => {
      if (!currentSubscriptions.has(type)) {
        currentSubscriptions.add(type);
        changedTypes.push(type);
      }
    });
  } else {
    requestedTypes.forEach((type) => {
      if (currentSubscriptions.delete(type)) {
        changedTypes.push(type);
      }
    });
  }

  sendAck(ws, action, requestedTypes, Array.from(currentSubscriptions));

  if (action === 'subscribe' && changedTypes.length > 0) {
    const snapshotTypes = new Set(changedTypes);
    if (currentSubscriptions.has('all')) {
      sendJson(ws, buildSnapshot(new Set(['all'])));
    } else {
      sendJson(ws, buildSnapshot(snapshotTypes));
    }
  }
}

function broadcastSnapshotToAll() {
  const metrics = getMetrics();
  const snapshotCache = metrics;

  wss.clients.forEach((client) => {
    if (client.readyState !== client.OPEN) return;
    const subscriptions = client.subscriptions;
    if (!subscriptions || subscriptions.size === 0) return;

    const payload = { timestamp: snapshotCache.timestamp };
    if (subscriptions.has('all')) {
      payload.cpu = snapshotCache.cpu;
      payload.memory = snapshotCache.memory;
      payload.disk = snapshotCache.disk;
      payload.uptime = snapshotCache.uptime;
    } else {
      if (subscriptions.has('cpu')) payload.cpu = snapshotCache.cpu;
      if (subscriptions.has('memory')) payload.memory = snapshotCache.memory;
      if (subscriptions.has('disk')) payload.disk = snapshotCache.disk;
      if (subscriptions.has('uptime')) payload.uptime = snapshotCache.uptime;
    }
    client.send(JSON.stringify(payload));
  });
}

wss.on('connection', (ws, request) => {
  const pathname = getPathname(request);
  const initial = AUTO_SUBSCRIBE_MAP[pathname] ?? [];
  ws.subscriptions = createSubscriptionSet(initial);

  sendWelcome(ws, Array.from(ws.subscriptions));
  if (initial.length > 0) {
    sendJson(ws, buildSnapshot(new Set(initial)));
  }

  ws.on('message', (message) => handleClientMessage(ws, message));
  ws.on('close', () => {
    ws.subscriptions = null;
  });
});

server.on('upgrade', (req, socket, head) => {
  const pathname = getPathname(req);
  if (!VALID_WS_PATHS.has(pathname)) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

async function startServer() {
  await refreshMetrics();
  setInterval(async () => {
    try {
      await refreshMetrics();
      broadcastSnapshotToAll();
    } catch (error) {
      console.error('Metric refresh failed', error);
    }
  }, 1000);

  server.listen(PORT, () => {
    console.log(`Resource Monitor API listening on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
