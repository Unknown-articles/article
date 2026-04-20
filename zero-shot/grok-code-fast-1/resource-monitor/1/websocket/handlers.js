import { getMetrics } from '../services/metricsService.js';

const clients = new Map(); // ws -> Set of metrics

export function handleWebSocketConnection(ws) {
  clients.set(ws, new Set());

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.action === 'subscribe' && Array.isArray(data.metrics)) {
        const subs = clients.get(ws);
        data.metrics.forEach(metric => {
          if (['cpu', 'memory', 'uptime', 'all'].includes(metric)) {
            subs.add(metric);
          }
        });
      } else if (data.action === 'unsubscribe' && Array.isArray(data.metrics)) {
        const subs = clients.get(ws);
        data.metrics.forEach(metric => subs.delete(metric));
      } else {
        ws.send(JSON.stringify({ error: 'Invalid action or metrics' }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
}

export function broadcastMetrics() {
  const currentMetrics = getMetrics();
  clients.forEach((subs, ws) => {
    if (subs.has('all') || subs.size === 0) {
      ws.send(JSON.stringify(currentMetrics));
    } else {
      const data = {};
      subs.forEach(metric => {
        if (currentMetrics[metric] !== undefined) {
          data[metric] = currentMetrics[metric];
        }
      });
      if (Object.keys(data).length > 0) {
        ws.send(JSON.stringify(data));
      }
    }
  });
}