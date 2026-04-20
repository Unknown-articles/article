import { WebSocketServer } from 'ws';
import { getCpuSnapshot, getMemorySnapshot, getDiskSnapshot, getUptimeSnapshot, onTick } from './metrics.js';

const VALID_TYPES = ['all', 'cpu', 'memory', 'disk', 'uptime'];
const INDIVIDUAL_TYPES = ['cpu', 'memory', 'disk', 'uptime'];

const METRIC_GETTERS = {
  cpu:    () => getCpuSnapshot()?.data ?? null,
  memory: () => getMemorySnapshot()?.data ?? null,
  disk:   () => getDiskSnapshot()?.data ?? null,
  uptime: () => getUptimeSnapshot()?.data ?? null,
};

const PATH_SUBSCRIPTIONS = new Map([
  ['cpu',    ['cpu']],
  ['memory', ['memory']],
  ['disk',   ['disk']],
  ['uptime', ['uptime']],
  ['all',    ['cpu', 'memory', 'disk', 'uptime']],
]);

// registry: socket → Set<string> of subscribed metric keys
const clients = new Map();

function resolveSubscription(url) {
  const match = url?.match(/^\/ws\/(.+)$/);
  if (!match) return [];
  return PATH_SUBSCRIPTIONS.get(match[1]) ?? [];
}

function expandTypes(metrics) {
  const expanded = new Set();
  for (const m of metrics) {
    if (m === 'all') {
      for (const t of INDIVIDUAL_TYPES) expanded.add(t);
    } else if (INDIVIDUAL_TYPES.includes(m)) {
      expanded.add(m);
    }
  }
  return expanded;
}

function buildSnapshot(keys, timestamp) {
  const snapshot = { timestamp };
  for (const key of keys) {
    snapshot[key] = METRIC_GETTERS[key]();
  }
  return snapshot;
}

function send(socket, obj) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

function err(socket, message) {
  send(socket, { event: 'error', message });
}

function handleMessage(socket, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    err(socket, 'Invalid JSON: message could not be parsed.');
    return;
  }

  const { action, metrics } = msg;

  if (action !== 'subscribe' && action !== 'unsubscribe') {
    err(socket, action === undefined
      ? 'Missing action field. Expected "subscribe" or "unsubscribe".'
      : `Unknown action: "${action}". Expected "subscribe" or "unsubscribe".`);
    return;
  }

  if (!Array.isArray(metrics) || metrics.length === 0) {
    err(socket, 'Missing or empty metrics array. Provide at least one metric type.');
    return;
  }

  const unknown = metrics.filter(m => !VALID_TYPES.includes(m));
  if (unknown.length > 0) {
    err(socket, `Unknown metric type${unknown.length > 1 ? 's' : ''}: ${unknown.map(u => `"${u}"`).join(', ')}.`);
    return;
  }

  const current = clients.get(socket);
  if (!current) return;

  const requested = expandTypes(metrics);
  const changed = [];

  if (action === 'subscribe') {
    for (const t of requested) {
      if (!current.has(t)) {
        current.add(t);
        changed.push(t);
      }
    }
    const subscribedTo = [...current];
    send(socket, { event: 'ack', action: 'subscribe', metrics: changed, subscribedTo });
    if (changed.length > 0) {
      send(socket, buildSnapshot(changed, new Date().toISOString()));
    }
  } else {
    for (const t of requested) {
      if (current.has(t)) {
        current.delete(t);
        changed.push(t);
      }
    }
    const subscribedTo = [...current];
    send(socket, { event: 'ack', action: 'unsubscribe', metrics: changed, subscribedTo });
  }
}

function broadcastTick() {
  const timestamp = new Date().toISOString();
  for (const [socket, subscribedTo] of clients) {
    if (subscribedTo.size === 0 || socket.readyState !== socket.OPEN) continue;
    socket.send(JSON.stringify(buildSnapshot(subscribedTo, timestamp)));
  }
}

const WS_PATH_RE = /^\/ws(\/[^?]*)?(\?.*)?$/;

export function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  onTick(broadcastTick);

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (!WS_PATH_RE.test(pathname)) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (socket, req) => {
    const pathname = req.url?.split('?')[0] ?? '';
    const initial = resolveSubscription(pathname);
    const subscribedTo = new Set(initial);
    clients.set(socket, subscribedTo);

    send(socket, {
      event: 'connected',
      subscribedTo: initial,
      validTypes: VALID_TYPES,
    });

    if (initial.length > 0) {
      send(socket, buildSnapshot(initial, new Date().toISOString()));
    }

    socket.on('message', (raw) => handleMessage(socket, raw));
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });

  return wss;
}

export { clients };
