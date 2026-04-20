import { buildMetricsPayload, getMetrics } from '../services/metricsService.js';
import { config } from '../config.js';

const subscriptions = new Map();

function getInitialSubscriptions(pathname) {
  if (pathname === '/ws/cpu') return new Set(['cpu']);
  if (pathname === '/ws/memory') return new Set(['memory']);
  if (pathname === '/ws/all') return new Set(['all']);
  return new Set();
}

export function setupMonitorWs(wss) {
  wss.on('connection', (ws, req) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    subscriptions.set(ws, getInitialSubscriptions(pathname));

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.action === 'subscribe' && Array.isArray(msg.metrics)) {
          subscriptions.set(ws, new Set(msg.metrics));
        } else if (msg.action === 'unsubscribe' && Array.isArray(msg.metrics)) {
          const subs = subscriptions.get(ws) || new Set();
          msg.metrics.forEach(metric => subs.delete(metric));
          subscriptions.set(ws, subs);
        } else {
          ws.send(JSON.stringify({ error: 'invalid_message' }));
        }
      } catch {
        ws.send(JSON.stringify({ error: 'invalid_json' }));
      }
    });

    ws.on('close', () => subscriptions.delete(ws));
    ws.on('error', () => subscriptions.delete(ws));
  });

  setInterval(() => {
    const metrics = getMetrics();
    for (const [ws, subs] of subscriptions) {
      if (ws.readyState !== 1) {
        subscriptions.delete(ws);
        continue;
      }

      const payload = buildMetricsPayload(metrics, subs);
      if (payload && Object.keys(payload).length > 1) {
        ws.send(JSON.stringify(payload));
      }
    }
  }, config.metricsIntervalMs);
}
