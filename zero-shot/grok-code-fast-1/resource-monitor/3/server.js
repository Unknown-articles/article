import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { getCpuMetrics, getMemoryMetrics, getDiskMetrics, getUptimeMetrics } from './metrics.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const VALID_TYPES = ['all', 'cpu', 'memory', 'disk', 'uptime'];

let cachedMetrics = {};
let lastTimestamp = null;

function collectMetrics() {
  const timestamp = new Date().toISOString();
  const cpu = getCpuMetrics();
  const memory = getMemoryMetrics();
  const disk = getDiskMetrics();
  const uptime = getUptimeMetrics();
  cachedMetrics = { timestamp, cpu, memory, disk, uptime };
  lastTimestamp = timestamp;
  // Broadcast to all clients
  broadcast();
}

function broadcast() {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      const subscribed = client.subscribedTo || [];
      const snapshot = { timestamp: cachedMetrics.timestamp };
      if (subscribed.includes('all') || subscribed.includes('cpu')) snapshot.cpu = cachedMetrics.cpu;
      if (subscribed.includes('all') || subscribed.includes('memory')) snapshot.memory = cachedMetrics.memory;
      if (subscribed.includes('all') || subscribed.includes('disk')) snapshot.disk = cachedMetrics.disk;
      if (subscribed.includes('all') || subscribed.includes('uptime')) snapshot.uptime = cachedMetrics.uptime;
      if (Object.keys(snapshot).length > 1) { // more than timestamp
        client.send(JSON.stringify(snapshot));
      }
    }
  });
}

setInterval(collectMetrics, 1000); // every 1 second
collectMetrics(); // initial

// REST API
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', (req, res) => {
  res.json(cachedMetrics);
});

app.get('/metrics/:type', (req, res) => {
  const type = req.params.type;
  if (!VALID_TYPES.slice(1).includes(type)) { // exclude 'all'
    return res.status(400).json({ error: `Invalid metric type: ${type}` });
  }
  res.json({ type, timestamp: cachedMetrics.timestamp, data: cachedMetrics[type] });
});

// 404 for unknown
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// WebSocket
wss.on('connection', (ws, req) => {
  const url = req.url;
  let initialSubscribed = [];
  if (url === '/ws/cpu') initialSubscribed = ['cpu'];
  else if (url === '/ws/memory') initialSubscribed = ['memory'];
  else if (url === '/ws/disk') initialSubscribed = ['disk'];
  else if (url === '/ws/uptime') initialSubscribed = ['uptime'];
  else if (url === '/ws/all') initialSubscribed = ['all'];
  // else /ws, empty

  ws.subscribedTo = initialSubscribed;

  // Send welcome
  ws.send(JSON.stringify({
    event: 'connected',
    subscribedTo: initialSubscribed,
    validTypes: VALID_TYPES
  }));

  // Send immediate snapshot if subscribed
  if (initialSubscribed.length > 0) {
    const snapshot = { timestamp: cachedMetrics.timestamp };
    if (initialSubscribed.includes('all') || initialSubscribed.includes('cpu')) snapshot.cpu = cachedMetrics.cpu;
    if (initialSubscribed.includes('all') || initialSubscribed.includes('memory')) snapshot.memory = cachedMetrics.memory;
    if (initialSubscribed.includes('all') || initialSubscribed.includes('disk')) snapshot.disk = cachedMetrics.disk;
    if (initialSubscribed.includes('all') || initialSubscribed.includes('uptime')) snapshot.uptime = cachedMetrics.uptime;
    if (Object.keys(snapshot).length > 1) {
      ws.send(JSON.stringify(snapshot));
    }
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.action === 'subscribe' || msg.action === 'unsubscribe') {
        const metrics = msg.metrics;
        if (!Array.isArray(metrics) || metrics.length === 0) {
          return ws.send(JSON.stringify({ event: 'error', message: 'Empty metrics array' }));
        }
        const invalid = metrics.filter(m => !VALID_TYPES.includes(m));
        if (invalid.length > 0) {
          return ws.send(JSON.stringify({ event: 'error', message: `Unknown metric type: ${invalid[0]}` }));
        }
        // Update subscriptions
        if (msg.action === 'subscribe') {
          metrics.forEach(m => {
            if (!ws.subscribedTo.includes(m)) ws.subscribedTo.push(m);
          });
        } else {
          ws.subscribedTo = ws.subscribedTo.filter(s => !metrics.includes(s));
        }
        // Send ack
        ws.send(JSON.stringify({
          event: 'ack',
          action: msg.action,
          metrics: metrics,
          subscribedTo: ws.subscribedTo
        }));
        // Send immediate snapshot for new subscriptions
        if (msg.action === 'subscribe') {
          const snapshot = { timestamp: cachedMetrics.timestamp };
          if (metrics.includes('all') || (metrics.includes('cpu') && !ws.subscribedTo.includes('all'))) snapshot.cpu = cachedMetrics.cpu;
          // Wait, better to check if newly subscribed
          // But to simplify, send full for subscribed
          if (ws.subscribedTo.includes('all') || ws.subscribedTo.includes('cpu')) snapshot.cpu = cachedMetrics.cpu;
          if (ws.subscribedTo.includes('all') || ws.subscribedTo.includes('memory')) snapshot.memory = cachedMetrics.memory;
          if (ws.subscribedTo.includes('all') || ws.subscribedTo.includes('disk')) snapshot.disk = cachedMetrics.disk;
          if (ws.subscribedTo.includes('all') || ws.subscribedTo.includes('uptime')) snapshot.uptime = cachedMetrics.uptime;
          if (Object.keys(snapshot).length > 1) {
            ws.send(JSON.stringify(snapshot));
          }
        }
      } else {
        ws.send(JSON.stringify({ event: 'error', message: 'Unknown action' }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    // Clean up if needed
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});