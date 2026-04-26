import { WebSocketServer } from 'ws';
import { VALID_METRIC_TYPES, VALID_WS_TYPES } from '../config.js';
import { getCache } from '../metricsCache.js';

const PATH_SUBSCRIPTIONS = {
  '/ws': [],
  '/ws/cpu': ['cpu'],
  '/ws/memory': ['memory'],
  '/ws/disk': ['disk'],
  '/ws/uptime': ['uptime'],
  '/ws/all': [...VALID_METRIC_TYPES],
};

function buildSnapshot(snapshot, subscriptions) {
  const msg = { timestamp: snapshot.timestamp };
  const types = subscriptions.includes('all') ? VALID_METRIC_TYPES : subscriptions;
  for (const t of types) {
    if (snapshot[t] !== undefined) msg[t] = snapshot[t];
  }
  return msg;
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function createWsServer(server) {
  const wss = new WebSocketServer({ server, path: undefined });

  wss.on('connection', (ws, req) => {
    const url = req.url?.split('?')[0] ?? '/ws';
    const initialSubs = PATH_SUBSCRIPTIONS[url] ?? [];

    ws.subscriptions = new Set(initialSubs);

    send(ws, {
      event: 'connected',
      subscribedTo: [...ws.subscriptions],
      validTypes: VALID_WS_TYPES,
    });

    if (ws.subscriptions.size > 0) {
      const snapshot = getCache();
      if (snapshot) send(ws, buildSnapshot(snapshot, [...ws.subscriptions]));
    }

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, { event: 'error', message: 'Invalid JSON' });
      }

      const { action, metrics } = msg;

      if (action !== 'subscribe' && action !== 'unsubscribe') {
        return send(ws, { event: 'error', message: `Unknown action: "${action}"` });
      }

      if (!Array.isArray(metrics) || metrics.length === 0) {
        return send(ws, { event: 'error', message: 'metrics must be a non-empty array' });
      }

      const unknown = metrics.filter(m => !VALID_WS_TYPES.includes(m));
      if (unknown.length > 0) {
        return send(ws, { event: 'error', message: `Unknown metric type(s): ${unknown.join(', ')}` });
      }

      if (action === 'subscribe') {
        metrics.forEach(m => ws.subscriptions.add(m));
      } else {
        metrics.forEach(m => ws.subscriptions.delete(m));
      }

      send(ws, {
        event: 'ack',
        action,
        metrics,
        subscribedTo: [...ws.subscriptions],
      });

      if (action === 'subscribe') {
        const snapshot = getCache();
        if (snapshot) send(ws, buildSnapshot(snapshot, metrics));
      }
    });

    ws.on('close', () => {
      ws.subscriptions = new Set();
    });

    ws.on('error', () => {});
  });

  return wss;
}

export function broadcast(wss, snapshot) {
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN || ws.subscriptions.size === 0) continue;
    send(ws, buildSnapshot(snapshot, [...ws.subscriptions]));
  }
}
