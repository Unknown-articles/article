import { WebSocket } from 'ws';
import { getSnapshot } from '../metrics/cache.js';

const VALID_TYPES = ['cpu', 'memory', 'disk', 'uptime'];
const ALL_VALID = ['all', ...VALID_TYPES];

const clients = new Set();

export function handleConnection(ws, path) {
  const suffix = path.replace(/^\/ws\/?/, '');

  let initialSubs;
  if (suffix === 'all') {
    initialSubs = new Set(VALID_TYPES);
  } else if (VALID_TYPES.includes(suffix)) {
    initialSubs = new Set([suffix]);
  } else {
    initialSubs = new Set();
  }

  const client = { ws, subscriptions: initialSubs };
  clients.add(client);

  send(ws, {
    event: 'connected',
    subscribedTo: [...client.subscriptions],
    validTypes: ALL_VALID,
  });

  if (client.subscriptions.size > 0) {
    sendSnapshotFor(client, [...client.subscriptions]);
  }

  ws.on('message', (raw) => handleMessage(client, raw));
  ws.on('close', () => clients.delete(client));
  ws.on('error', () => clients.delete(client));
}

function handleMessage(client, raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return send(client.ws, { event: 'error', message: 'Invalid JSON' });
  }

  const { action, metrics } = msg;

  if (action !== 'subscribe' && action !== 'unsubscribe') {
    return send(client.ws, { event: 'error', message: `Unknown action: "${action}"` });
  }

  if (!Array.isArray(metrics) || metrics.length === 0) {
    return send(client.ws, { event: 'error', message: 'metrics must be a non-empty array' });
  }

  const unknown = metrics.filter((m) => !VALID_TYPES.includes(m) && m !== 'all');
  if (unknown.length > 0) {
    return send(client.ws, { event: 'error', message: `Unknown metric type: "${unknown[0]}"` });
  }

  const expanded = metrics.includes('all') ? [...VALID_TYPES] : metrics;

  if (action === 'subscribe') {
    for (const m of expanded) client.subscriptions.add(m);
  } else {
    for (const m of expanded) client.subscriptions.delete(m);
  }

  send(client.ws, {
    event: 'ack',
    action,
    metrics,
    subscribedTo: [...client.subscriptions],
  });

  if (action === 'subscribe') {
    sendSnapshotFor(client, expanded);
  }
}

function sendSnapshotFor(client, types) {
  const data = getSnapshot();
  if (!data) return;

  const snapshot = { timestamp: data.timestamp };
  for (const t of types) {
    snapshot[t] = data[t];
  }

  send(client.ws, snapshot);
}

export function broadcast(data) {
  for (const client of clients) {
    if (!client.subscriptions.size) continue;
    if (client.ws.readyState !== WebSocket.OPEN) continue;

    const snapshot = { timestamp: data.timestamp };
    for (const t of client.subscriptions) {
      snapshot[t] = data[t];
    }

    send(client.ws, snapshot);
  }
}

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}
