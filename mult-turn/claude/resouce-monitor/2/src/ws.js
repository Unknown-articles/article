import { WebSocketServer } from 'ws';
import { getCpuState, getMemState, getDiskState, getUptimeState, addUpdateListener } from './metrics.js';

const ALLOWED_TYPES = ['all', 'cpu', 'memory', 'disk', 'uptime'];
const SINGLE_TYPES = ['cpu', 'memory', 'disk', 'uptime'];

const METRIC_RESOLVERS = {
  cpu:    () => getCpuState()?.data ?? null,
  memory: () => getMemState()?.data ?? null,
  disk:   () => getDiskState()?.data ?? null,
  uptime: () => getUptimeState()?.data ?? null,
};

const ROUTE_METRICS = new Map([
  ['cpu',    ['cpu']],
  ['memory', ['memory']],
  ['disk',   ['disk']],
  ['uptime', ['uptime']],
  ['all',    ['cpu', 'memory', 'disk', 'uptime']],
]);

// registry: socket → Set<string> of subscribed metric keys
const activeConnections = new Map();

function parseSubscriptionPath(url) {
  const match = url?.match(/^\/ws\/(.+)$/);
  if (!match) return [];
  return ROUTE_METRICS.get(match[1]) ?? [];
}

function resolveMetricTypes(metrics) {
  const expanded = new Set();
  for (const m of metrics) {
    if (m === 'all') {
      for (const t of SINGLE_TYPES) expanded.add(t);
    } else if (SINGLE_TYPES.includes(m)) {
      expanded.add(m);
    }
  }
  return expanded;
}

function assemblePayload(keys, timestamp) {
  const snapshot = { timestamp };
  for (const key of keys) {
    snapshot[key] = METRIC_RESOLVERS[key]();
  }
  return snapshot;
}

function transmit(socket, obj) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

function sendError(socket, message) {
  transmit(socket, { event: 'error', message });
}

function processClientMsg(socket, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendError(socket, 'Invalid JSON: message could not be parsed.');
    return;
  }

  const { action, metrics } = msg;

  if (action !== 'subscribe' && action !== 'unsubscribe') {
    sendError(socket, action === undefined
      ? 'Missing action field. Expected "subscribe" or "unsubscribe".'
      : `Unknown action: "${action}". Expected "subscribe" or "unsubscribe".`);
    return;
  }

  if (!Array.isArray(metrics) || metrics.length === 0) {
    sendError(socket, 'Missing or empty metrics array. Provide at least one metric type.');
    return;
  }

  const unknown = metrics.filter(m => !ALLOWED_TYPES.includes(m));
  if (unknown.length > 0) {
    sendError(socket, `Unknown metric type${unknown.length > 1 ? 's' : ''}: ${unknown.map(u => `"${u}"`).join(', ')}.`);
    return;
  }

  const current = activeConnections.get(socket);
  if (!current) return;

  const requested = resolveMetricTypes(metrics);
  const changed = [];

  if (action === 'subscribe') {
    for (const t of requested) {
      if (!current.has(t)) {
        current.add(t);
        changed.push(t);
      }
    }
    const subscribedTo = [...current];
    transmit(socket, { event: 'ack', action: 'subscribe', metrics: changed, subscribedTo });
    if (changed.length > 0) {
      transmit(socket, assemblePayload(changed, new Date().toISOString()));
    }
  } else {
    for (const t of requested) {
      if (current.has(t)) {
        current.delete(t);
        changed.push(t);
      }
    }
    const subscribedTo = [...current];
    transmit(socket, { event: 'ack', action: 'unsubscribe', metrics: changed, subscribedTo });
  }
}

function dispatchUpdate() {
  const timestamp = new Date().toISOString();
  for (const [socket, subscribedTo] of activeConnections) {
    if (subscribedTo.size === 0 || socket.readyState !== socket.OPEN) continue;
    socket.send(JSON.stringify(assemblePayload(subscribedTo, timestamp)));
  }
}

const WS_ROUTE_RE = /^\/ws(\/[^?]*)?(\?.*)?$/;

export function mountWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  addUpdateListener(dispatchUpdate);

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (!WS_ROUTE_RE.test(pathname)) {
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
    const initial = parseSubscriptionPath(pathname);
    const subscribedTo = new Set(initial);
    activeConnections.set(socket, subscribedTo);

    transmit(socket, {
      event: 'connected',
      subscribedTo: initial,
      validTypes: ALLOWED_TYPES,
    });

    if (initial.length > 0) {
      transmit(socket, assemblePayload(initial, new Date().toISOString()));
    }

    socket.on('message', (raw) => processClientMsg(socket, raw));
    socket.on('close', () => activeConnections.delete(socket));
    socket.on('error', () => activeConnections.delete(socket));
  });

  return wss;
}

export { activeConnections };
