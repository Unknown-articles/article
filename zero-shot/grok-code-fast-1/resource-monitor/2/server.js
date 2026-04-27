import express from 'express';
import { WebSocketServer } from 'ws';
import { collectMetrics } from './metrics.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to set JSON content type
app.use((req, res, next) => {
  if (req.path.startsWith('/metrics') || req.path === '/health') {
    res.setHeader('Content-Type', 'application/json');
  }
  next();
});

// REST API routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

let cachedMetrics = null;

app.get('/metrics', (req, res) => {
  if (!cachedMetrics) {
    cachedMetrics = collectMetrics();
  }
  res.json(cachedMetrics);
});

app.get('/metrics/:type', (req, res) => {
  const validTypes = ['cpu', 'memory', 'disk', 'uptime'];
  const { type } = req.params;

  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: ${type}` });
  }

  if (!cachedMetrics) {
    cachedMetrics = collectMetrics();
  }

  res.json({
    type,
    timestamp: cachedMetrics.timestamp,
    data: cachedMetrics[type]
  });
});

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

// Map of clients to their subscriptions
const clients = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  let initialSubscriptions = [];

  if (path === '/ws/cpu') {
    initialSubscriptions = ['cpu'];
  } else if (path === '/ws/memory') {
    initialSubscriptions = ['memory'];
  } else if (path === '/ws/disk') {
    initialSubscriptions = ['disk'];
  } else if (path === '/ws/uptime') {
    initialSubscriptions = ['uptime'];
  } else if (path === '/ws/all') {
    initialSubscriptions = ['cpu', 'memory', 'disk', 'uptime'];
  } else if (path === '/ws') {
    initialSubscriptions = [];
  } else {
    ws.send(JSON.stringify({ event: 'error', message: 'Invalid WebSocket endpoint' }));
    ws.close();
    return;
  }

  clients.set(ws, new Set(initialSubscriptions));

  // Send welcome message
  ws.send(JSON.stringify({
    event: 'connected',
    subscribedTo: Array.from(clients.get(ws)),
    validTypes: ['all', 'cpu', 'memory', 'disk', 'uptime']
  }));

  // Send immediate snapshot if subscribed
  if (initialSubscriptions.length > 0) {
    sendSnapshot(ws, initialSubscriptions);
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.action === 'subscribe' || message.action === 'unsubscribe') {
        const { metrics } = message;
        if (!Array.isArray(metrics) || metrics.length === 0) {
          ws.send(JSON.stringify({ event: 'error', message: 'Metrics array must be non-empty' }));
          return;
        }

        const validTypes = ['cpu', 'memory', 'disk', 'uptime', 'all'];
        const invalid = metrics.filter(m => !validTypes.includes(m));
        if (invalid.length > 0) {
          ws.send(JSON.stringify({ event: 'error', message: `Unknown metric type: ${invalid[0]}` }));
          return;
        }

        const subscriptions = clients.get(ws);
        const changed = [];

        if (message.action === 'subscribe') {
          metrics.forEach(m => {
            if (m === 'all') {
              ['cpu', 'memory', 'disk', 'uptime'].forEach(type => {
                if (!subscriptions.has(type)) {
                  subscriptions.add(type);
                  changed.push(type);
                }
              });
            } else if (!subscriptions.has(m)) {
              subscriptions.add(m);
              changed.push(m);
            }
          });
        } else { // unsubscribe
          metrics.forEach(m => {
            if (m === 'all') {
              ['cpu', 'memory', 'disk', 'uptime'].forEach(type => {
                if (subscriptions.has(type)) {
                  subscriptions.delete(type);
                  changed.push(type);
                }
              });
            } else if (subscriptions.has(m)) {
              subscriptions.delete(m);
              changed.push(m);
            }
          });
        }

        // Send ack
        ws.send(JSON.stringify({
          event: 'ack',
          action: message.action,
          metrics: changed,
          subscribedTo: Array.from(subscriptions)
        }));

        // Send immediate snapshot for newly subscribed
        if (message.action === 'subscribe' && changed.length > 0) {
          sendSnapshot(ws, changed);
        }
      } else {
        ws.send(JSON.stringify({ event: 'error', message: 'Unknown action' }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function sendSnapshot(ws, types) {
  if (!cachedMetrics) {
    cachedMetrics = collectMetrics();
  }

  const snapshot = { timestamp: cachedMetrics.timestamp };
  types.forEach(type => {
    if (cachedMetrics[type]) {
      snapshot[type] = cachedMetrics[type];
    }
  });

  ws.send(JSON.stringify(snapshot));
}

// Collect metrics every 1 second
setInterval(() => {
  cachedMetrics = collectMetrics();

  // Broadcast to all subscribed clients
  clients.forEach((subscriptions, ws) => {
    if (ws.readyState === ws.OPEN && subscriptions.size > 0) {
      const snapshot = { timestamp: cachedMetrics.timestamp };
      subscriptions.forEach(type => {
        if (cachedMetrics[type]) {
          snapshot[type] = cachedMetrics[type];
        }
      });
      ws.send(JSON.stringify(snapshot));
    }
  });
}, 1000);