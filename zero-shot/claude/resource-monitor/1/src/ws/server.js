import { WebSocketServer } from 'ws';
import { getSnapshot, onUpdate } from '../metrics/cache.js';

const VALID_TYPES = ['cpu', 'memory', 'disk', 'uptime'];
const ALL_TYPES = ['all', ...VALID_TYPES];

function resolveTypes(requested) {
  if (requested.includes('all')) return [...VALID_TYPES];
  return requested;
}

function buildSnapshot(snapshot, subscriptions) {
  const msg = { timestamp: snapshot.timestamp };
  const types = resolveTypes([...subscriptions]);
  for (const t of types) {
    if (snapshot[t] !== undefined) msg[t] = snapshot[t];
  }
  return msg;
}

function pathToTypes(pathname) {
  if (!pathname) return [];
  const segment = pathname.replace(/^\/ws\/?/, '');
  if (!segment) return [];
  if (segment === 'all') return [...VALID_TYPES];
  if (VALID_TYPES.includes(segment)) return [segment];
  return [];
}

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const initialTypes = pathToTypes(url.pathname);
    const subscriptions = new Set(initialTypes);

    const welcome = {
      event: 'connected',
      subscribedTo: [...subscriptions],
      validTypes: ALL_TYPES,
    };
    ws.send(JSON.stringify(welcome));

    if (subscriptions.size > 0) {
      const snap = getSnapshot();
      if (snap) ws.send(JSON.stringify(buildSnapshot(snap, subscriptions)));
    }

    const removeListener = onUpdate((snapshot) => {
      if (ws.readyState !== ws.OPEN) return;
      if (subscriptions.size === 0) return;
      ws.send(JSON.stringify(buildSnapshot(snapshot, subscriptions)));
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON' }));
        return;
      }

      const { action, metrics } = msg;

      if (action !== 'subscribe' && action !== 'unsubscribe') {
        ws.send(JSON.stringify({ event: 'error', message: `Unknown action: "${action}"` }));
        return;
      }

      if (!Array.isArray(metrics) || metrics.length === 0) {
        ws.send(JSON.stringify({ event: 'error', message: 'metrics must be a non-empty array' }));
        return;
      }

      const unknowns = metrics.filter(t => !ALL_TYPES.includes(t));
      if (unknowns.length > 0) {
        ws.send(JSON.stringify({ event: 'error', message: `Unknown metric type(s): ${unknowns.join(', ')}` }));
        return;
      }

      const expanded = metrics.includes('all') ? [...VALID_TYPES] : metrics;

      if (action === 'subscribe') {
        for (const t of expanded) subscriptions.add(t);
      } else {
        for (const t of expanded) subscriptions.delete(t);
      }

      ws.send(JSON.stringify({
        event: 'ack',
        action,
        metrics: expanded,
        subscribedTo: [...subscriptions],
      }));

      if (action === 'subscribe') {
        const snap = getSnapshot();
        if (snap) ws.send(JSON.stringify(buildSnapshot(snap, new Set(expanded))));
      }
    });

    ws.on('close', () => removeListener());
    ws.on('error', () => removeListener());
  });

  return wss;
}
