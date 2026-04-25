import { WebSocketServer, WebSocket } from 'ws';
import { subscribe, unsubscribe, getLatestMetrics } from '../services/metricsService.js';
import { VALID_METRIC_TYPES } from '../config.js';

const ALL_TYPES = ['all', ...VALID_METRIC_TYPES];

/**
 * Extract the subscribed metric types from an incoming message.
 * Returns an array of valid types, or an error string.
 */
function parseSubscription(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return { error: 'Invalid JSON' };
  }

  const { action, metrics } = msg;

  if (action !== 'subscribe' && action !== 'unsubscribe') {
    return { error: 'action must be "subscribe" or "unsubscribe"' };
  }

  if (!Array.isArray(metrics) || metrics.length === 0) {
    return { error: '"metrics" must be a non-empty array' };
  }

  const invalid = metrics.filter((m) => !ALL_TYPES.includes(m));
  if (invalid.length > 0) {
    return { error: `Unknown metric type(s): ${invalid.join(', ')}. Valid: ${ALL_TYPES.join(', ')}` };
  }

  return { action, types: metrics };
}

/**
 * Build the payload to send to a client given its subscribed types and the full snapshot.
 */
function buildPayload(subscriptions, snapshot) {
  if (subscriptions.has('all')) {
    return snapshot;
  }

  const partial = { timestamp: snapshot.timestamp };
  for (const type of subscriptions) {
    if (snapshot[type] !== undefined) {
      partial[type] = snapshot[type];
    }
  }
  return partial;
}

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Attach WebSocket handling to the HTTP server.
 * Supports path-based subscriptions (/ws/cpu, /ws/memory, /ws/all, /ws/disk, /ws/uptime)
 * as well as dynamic subscribe/unsubscribe messages on any path.
 */
export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // A single broadcast callback registered with metricsService.
  // clientSubscriptions: Map<WebSocket, Set<string>>
  const clientSubscriptions = new Map();

  function broadcastCallback(snapshot) {
    for (const [ws, subscriptions] of clientSubscriptions) {
      if (ws.readyState !== WebSocket.OPEN) {
        clientSubscriptions.delete(ws);
        continue;
      }
      if (subscriptions.size === 0) continue;

      send(ws, buildPayload(subscriptions, snapshot));
    }
  }

  subscribe(broadcastCallback);

  wss.on('connection', (ws, req) => {
    // Determine initial subscription from URL path.
    const url = req.url ?? '';
    const pathPart = url.replace(/^\/ws\/?/, '').split('?')[0];
    const initialType = ALL_TYPES.includes(pathPart) ? pathPart : null;

    const subscriptions = new Set(initialType ? [initialType] : []);
    clientSubscriptions.set(ws, subscriptions);

    // Send a welcome / ack.
    send(ws, {
      event: 'connected',
      subscribedTo: [...subscriptions],
      validTypes: ALL_TYPES,
    });

    // Send the current snapshot immediately if already subscribed.
    if (subscriptions.size > 0) {
      const snapshot = getLatestMetrics();
      if (snapshot) send(ws, buildPayload(subscriptions, snapshot));
    }

    ws.on('message', (raw) => {
      const result = parseSubscription(raw.toString());

      if (result.error) {
        return send(ws, { event: 'error', message: result.error });
      }

      const { action, types } = result;

      if (action === 'subscribe') {
        for (const t of types) subscriptions.add(t);
      } else {
        for (const t of types) subscriptions.delete(t);
      }

      send(ws, { event: 'ack', action, metrics: types, subscribedTo: [...subscriptions] });

      // Immediately push current data on subscribe.
      if (action === 'subscribe') {
        const snapshot = getLatestMetrics();
        if (snapshot) send(ws, buildPayload(subscriptions, snapshot));
      }
    });

    ws.on('close', () => {
      clientSubscriptions.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[ws] client error:', err.message);
      clientSubscriptions.delete(ws);
    });
  });

  wss.on('error', (err) => {
    console.error('[wss] server error:', err.message);
  });

  return wss;
}
