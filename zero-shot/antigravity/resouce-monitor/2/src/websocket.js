import { WebSocketServer } from 'ws';
import { metricsEmitter, getCachedSnapshot } from './metrics.js';

const VALID_TYPES = ['all', 'cpu', 'memory', 'disk', 'uptime'];
const ALL_METRICS = ['cpu', 'memory', 'disk', 'uptime'];

export function initializeWebSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    // Determine path
    // example: /ws/cpu -> "cpu"
    const match = req.url?.match(/^\/ws\/?(.*)$/);
    if (!match) {
      ws.close(1008, 'Invalid path');
      return;
    }

    const pathExt = match[1];
    let initialSubscriptions = [];

    if (pathExt === 'all') {
      initialSubscriptions = [...ALL_METRICS];
    } else if (ALL_METRICS.includes(pathExt)) {
      initialSubscriptions = [pathExt];
    } else if (pathExt === '') {
      initialSubscriptions = [];
    } else {
      ws.send(JSON.stringify({ event: 'error', message: 'Unknown metric type in path' }));
      ws.close(1008, 'Unknown type');
      return;
    }

    // Attach subscriptions to the socket client
    ws.subscriptions = new Set(initialSubscriptions);

    // Send Welcome
    ws.send(JSON.stringify({
      event: 'connected',
      subscribedTo: Array.from(ws.subscriptions),
      validTypes: VALID_TYPES
    }));

    if (ws.subscriptions.size > 0) {
      const snapshot = getCachedSnapshot();
      if (snapshot) {
        const filteredSnapshot = { timestamp: snapshot.timestamp };
        for (const sub of ws.subscriptions) {
          if (snapshot[sub] !== undefined) {
            filteredSnapshot[sub] = snapshot[sub];
          }
        }
        ws.send(JSON.stringify(filteredSnapshot));
      }
    }

    ws.on('message', (message) => {
      let data;
      try {
        data = JSON.parse(message);
      } catch (err) {
        return ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON' }));
      }

      const { action, metrics } = data;

      if (action !== 'subscribe' && action !== 'unsubscribe') {
        return ws.send(JSON.stringify({ event: 'error', message: 'Unknown action' }));
      }

      if (!Array.isArray(metrics) || metrics.length === 0) {
        return ws.send(JSON.stringify({ event: 'error', message: 'Empty metrics array' }));
      }

      let parsedMetrics = [];
      for (const m of metrics) {
        if (m === 'all') {
          parsedMetrics.push(...ALL_METRICS);
        } else if (ALL_METRICS.includes(m)) {
          parsedMetrics.push(m);
        } else {
          return ws.send(JSON.stringify({ event: 'error', message: `Unknown metric type: ${m}` }));
        }
      }
      
      const uniqueMetrics = [...new Set(parsedMetrics)];
      const changed = [];

      if (action === 'subscribe') {
        for (const m of uniqueMetrics) {
          if (!ws.subscriptions.has(m)) {
            ws.subscriptions.add(m);
            changed.push(m);
          }
        }
      } else {
        for (const m of uniqueMetrics) {
          if (ws.subscriptions.has(m)) {
            ws.subscriptions.delete(m);
            changed.push(m);
          }
        }
      }

      ws.send(JSON.stringify({
        event: 'ack',
        action,
        metrics: changed,
        subscribedTo: Array.from(ws.subscriptions)
      }));

      // Immediate snapshot for newly subscribed
      if (action === 'subscribe' && changed.length > 0) {
        const snapshot = getCachedSnapshot();
        if (snapshot) {
          const filteredSnapshot = { timestamp: snapshot.timestamp };
          for (const sub of changed) {
            if (snapshot[sub] !== undefined) {
              filteredSnapshot[sub] = snapshot[sub];
            }
          }
          ws.send(JSON.stringify(filteredSnapshot));
        }
      }
    });

    ws.on('close', () => {
      // Disconnection handled automatically as `ws` leaves `wss.clients` 
      // and broadcast checks `readyState === 1`.
    });
  });

  // Broadcast logic
  metricsEmitter.on('snapshot', (snapshot) => {
    if (!snapshot) return;

    for (const client of wss.clients) {
      if (client.readyState === 1 && client.subscriptions) { // WebSocket.OPEN is 1
        const subs = Array.from(client.subscriptions);
        if (subs.length === 0) continue;

        const filteredSnapshot = { timestamp: snapshot.timestamp };
        for (const sub of subs) {
          if (snapshot[sub] !== undefined) {
            filteredSnapshot[sub] = snapshot[sub];
          }
        }

        client.send(JSON.stringify(filteredSnapshot));
      }
    }
  });

  return wss;
}
