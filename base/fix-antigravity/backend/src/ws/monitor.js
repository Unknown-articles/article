import { getMetrics } from '../services/metricsService.js';
import { convertDate } from '../utils.js';

const subscriptions = new Map();

export function setupMonitorWs(wss) {
  wss.on('connection', (ws, req) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    let initial = new Set();
    if (pathname === '/ws/cpu') initial.add('cpu');
    else if (pathname === '/ws/memory') initial.add('memory');
    else if (pathname === '/ws/all') initial.add('all');

    subscriptions.set(ws, initial);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.action === 'subscribe' && Array.isArray(msg.metrics)) {
          subscriptions.set(ws, new Set(msg.metrics));
        } else if (msg.action === 'unsubscribe' && Array.isArray(msg.metrics)) {
          const subs = subscriptions.get(ws) || new Set();
          msg.metrics.forEach(m => subs.delete(m));
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
      if (ws.readyState !== 1) { subscriptions.delete(ws); continue; }
      let payload = null;
      if (subs.has('all')) payload = metrics;
      else {
        payload = {};
        if (subs.has('cpu')) payload.cpu = metrics.cpu;
        if (subs.has('memory')) payload.memory = metrics.memory;
        if (subs.has('uptime')) payload.uptime = metrics.uptime;
        if (subs.has('disk')) payload.disk = metrics.disk;
        if (subs.has('network')) payload.network = metrics.network;
        if (subs.has('gpu')) payload.gpu = metrics.gpu;
        if (subs.has('processes')) payload.processes = metrics.processes;
        payload.timestamp = metrics.timestamp;
        payload.convertedUptime = convertDate(metrics.uptime);
      }
      if (payload && Object.keys(payload).length > 1) {
        ws.send(JSON.stringify(payload));
      }
    }
  }, 1000);
}
