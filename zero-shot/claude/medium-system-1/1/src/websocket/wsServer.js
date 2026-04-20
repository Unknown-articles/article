import { WebSocketServer } from 'ws';
import { validateAccessToken } from '../services/oidcService.js';

// ws → { userId, authenticated, subscriptions }
const clients = new Map();

// Auth timeout — unauthenticated connections are closed after 30 s
const AUTH_TIMEOUT_MS = 30_000;

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.set(ws, { userId: null, authenticated: false, subscriptions: new Set() });

    // Enforce auth within 30 seconds
    const authTimer = setTimeout(() => {
      if (!clients.get(ws)?.authenticated) {
        send(ws, { type: 'error', error: 'auth_timeout', message: 'Authentication required within 30 s' });
        ws.close(1008, 'Auth timeout');
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch { return send(ws, { type: 'error', error: 'invalid_json', message: 'Message must be valid JSON' }); }

      handleMessage(ws, msg);
    });

    ws.on('close',  () => { clearTimeout(authTimer); clients.delete(ws); });
    ws.on('error', (err) => { console.error('WebSocket error:', err.message); clients.delete(ws); });

    send(ws, { type: 'connected', message: 'Send {"type":"auth","token":"<access_token>"} to authenticate' });
  });

  return wss;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(ws, data) {
  if (ws.readyState === 1 /* OPEN */) ws.send(JSON.stringify(data));
}

function handleMessage(ws, msg) {
  const client = clients.get(ws);

  // ── Auth handshake ───────────────────────────────────────────────────────────
  if (msg.type === 'auth') {
    const user = validateAccessToken(msg.token);
    if (!user) {
      send(ws, { type: 'auth', status: 'error', message: 'Invalid or expired token' });
      ws.close(1008, 'Unauthorized');
      return;
    }
    client.authenticated = true;
    client.userId        = user.id;
    send(ws, { type: 'auth', status: 'ok', userId: user.id });
    return;
  }

  // ── Guard: all other actions require authentication ──────────────────────────
  if (!client.authenticated) {
    send(ws, { type: 'error', error: 'not_authenticated', message: 'Send {"type":"auth","token":"..."} first' });
    return;
  }

  // ── Subscription management ──────────────────────────────────────────────────
  if (msg.action === 'subscribe' && Array.isArray(msg.metrics)) {
    msg.metrics.forEach(m => client.subscriptions.add(m));
    send(ws, { type: 'subscribed', metrics: [...client.subscriptions] });
    return;
  }

  if (msg.action === 'unsubscribe' && Array.isArray(msg.metrics)) {
    msg.metrics.forEach(m => client.subscriptions.delete(m));
    send(ws, { type: 'unsubscribed', metrics: [...client.subscriptions] });
    return;
  }

  send(ws, { type: 'error', error: 'unknown_action', message: 'Unrecognised action' });
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

/**
 * Called once per metrics interval with the latest snapshot.
 * Each client receives only the metrics it has subscribed to.
 */
export function broadcastMetrics(snapshot) {
  for (const [ws, { subscriptions }] of clients) {
    if (ws.readyState !== 1 || subscriptions.size === 0) continue;

    const data = {};
    for (const key of subscriptions) {
      if (key in snapshot) data[key] = snapshot[key];
    }

    if (Object.keys(data).length > 0) {
      try { ws.send(JSON.stringify({ type: 'update', data })); }
      catch (err) { console.error('Broadcast error:', err.message); }
    }
  }
}
