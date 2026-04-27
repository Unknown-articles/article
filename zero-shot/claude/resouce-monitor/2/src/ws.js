import { WebSocketServer } from 'ws';
import { getSnapshot, subscribe } from './cache.js';
import { VALID_TYPES } from './metrics.js';

const ALL_TYPES = ['cpu', 'memory', 'disk', 'uptime'];
const VALID_WS_TYPES = ['all', ...ALL_TYPES];

function autoSubscribeFromPath(pathname) {
  if (!pathname) return [];
  const seg = pathname.replace(/^\/ws\/?/, '').toLowerCase();
  if (seg === 'all') return [...ALL_TYPES];
  if (ALL_TYPES.includes(seg)) return [seg];
  return [];
}

function buildSnapshot(snap, subs) {
  const msg = { timestamp: snap.timestamp };
  const effective = subs.has('all') ? ALL_TYPES : [...subs].filter(t => ALL_TYPES.includes(t));
  for (const t of effective) msg[t] = snap[t];
  return msg;
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function handleMessage(ws, subs, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return send(ws, { event: 'error', message: 'Invalid JSON' });
  }

  const { action, metrics } = msg;

  if (action !== 'subscribe' && action !== 'unsubscribe') {
    return send(ws, { event: 'error', message: `Unknown action: "${action}"` });
  }

  if (!Array.isArray(metrics) || metrics.length === 0) {
    return send(ws, { event: 'error', message: 'metrics array must be non-empty' });
  }

  const unknown = metrics.filter(t => !VALID_WS_TYPES.includes(t));
  if (unknown.length > 0) {
    return send(ws, { event: 'error', message: `Unknown metric type(s): ${unknown.join(', ')}` });
  }

  if (action === 'subscribe') {
    for (const t of metrics) subs.add(t);
    send(ws, { event: 'ack', action: 'subscribe', metrics, subscribedTo: [...subs] });
    // immediate snapshot for newly subscribed types
    const snap = getSnapshot();
    const preview = { timestamp: snap.timestamp };
    const effective = subs.has('all') ? ALL_TYPES : metrics.filter(t => ALL_TYPES.includes(t));
    for (const t of effective) preview[t] = snap[t];
    send(ws, preview);
  } else {
    for (const t of metrics) subs.delete(t);
    send(ws, { event: 'ack', action: 'unsubscribe', metrics, subscribedTo: [...subs] });
  }
}

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!url.pathname.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const initial = autoSubscribeFromPath(url.pathname);
    const subs = new Set(initial);

    send(ws, { event: 'connected', subscribedTo: [...subs], validTypes: VALID_WS_TYPES });

    // immediate snapshot for path-based subscriptions
    if (subs.size > 0) {
      const snap = getSnapshot();
      send(ws, buildSnapshot(snap, subs));
    }

    const unsub = subscribe(snap => {
      if (ws.readyState !== ws.OPEN) return;
      if (subs.size === 0) return;
      send(ws, buildSnapshot(snap, subs));
    });

    ws.on('message', raw => handleMessage(ws, subs, raw.toString()));

    ws.on('close', unsub);
    ws.on('error', unsub);
  });

  return wss;
}
