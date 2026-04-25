import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import { getCpuMetrics, getMemoryMetrics, getDiskMetrics, getUptimeMetrics } from './src/metrics.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

let cachedMetrics = {};
let clients = new Map(); // ws -> Set of subscribed types

function collectMetrics() {
  const timestamp = new Date().toISOString();
  cachedMetrics = {
    timestamp,
    cpu: getCpuMetrics(),
    memory: getMemoryMetrics(),
    disk: getDiskMetrics(),
    uptime: getUptimeMetrics()
  };
  // broadcast to clients
  for (const [ws, subs] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      const data = { timestamp };
      let hasAll = false;
      for (const type of subs) {
        if (type === 'all') {
          hasAll = true;
          break;
        }
      }
      if (hasAll) {
        data.cpu = cachedMetrics.cpu;
        data.memory = cachedMetrics.memory;
        data.disk = cachedMetrics.disk;
        data.uptime = cachedMetrics.uptime;
      } else {
        for (const type of subs) {
          if (cachedMetrics[type]) {
            data[type] = cachedMetrics[type];
          }
        }
      }
      ws.send(JSON.stringify(data));
    }
  }
}

setInterval(collectMetrics, 1000);

// Initial collection
collectMetrics();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', (req, res) => {
  res.json(cachedMetrics);
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  const validTypes = ['cpu', 'memory', 'disk', 'uptime'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: ${type}` });
  }
  res.json({
    type,
    timestamp: cachedMetrics.timestamp,
    data: cachedMetrics[type]
  });
});

wss.on('connection', (ws, req) => {
  const url = req.url;
  let subscribedTo = new Set();
  if (url === '/ws') {
    // no auto subscribe
  } else if (url === '/ws/cpu') {
    subscribedTo.add('cpu');
  } else if (url === '/ws/memory') {
    subscribedTo.add('memory');
  } else if (url === '/ws/disk') {
    subscribedTo.add('disk');
  } else if (url === '/ws/uptime') {
    subscribedTo.add('uptime');
  } else if (url === '/ws/all') {
    subscribedTo.add('all');
  }
  clients.set(ws, subscribedTo);
  // send welcome
  ws.send(JSON.stringify({
    event: 'connected',
    subscribedTo: Array.from(subscribedTo),
    validTypes: ['all', 'cpu', 'memory', 'disk', 'uptime']
  }));
  // if subscribed, send immediate snapshot
  if (subscribedTo.size > 0) {
    const data = { timestamp: cachedMetrics.timestamp };
    let hasAll = false;
    for (const type of subscribedTo) {
      if (type === 'all') {
        hasAll = true;
        break;
      }
    }
    if (hasAll) {
      data.cpu = cachedMetrics.cpu;
      data.memory = cachedMetrics.memory;
      data.disk = cachedMetrics.disk;
      data.uptime = cachedMetrics.uptime;
    } else {
      for (const type of subscribedTo) {
        if (cachedMetrics[type]) {
          data[type] = cachedMetrics[type];
        }
      }
    }
    ws.send(JSON.stringify(data));
  }
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());
      const { action, metrics } = msg;
      if (action !== 'subscribe' && action !== 'unsubscribe') {
        return ws.send(JSON.stringify({ event: 'error', message: 'Unknown action' }));
      }
      if (!Array.isArray(metrics) || metrics.length === 0) {
        return ws.send(JSON.stringify({ event: 'error', message: 'Metrics array must be non-empty' }));
      }
      const valid = ['all', 'cpu', 'memory', 'disk', 'uptime'];
      for (const m of metrics) {
        if (!valid.includes(m)) {
          return ws.send(JSON.stringify({ event: 'error', message: `Unknown metric type: ${m}` }));
        }
      }
      if (action === 'subscribe') {
        for (const m of metrics) {
          subscribedTo.add(m);
        }
        // send ack
        ws.send(JSON.stringify({
          event: 'ack',
          action: 'subscribe',
          metrics,
          subscribedTo: Array.from(subscribedTo)
        }));
        // send immediate snapshot for new
        const data = { timestamp: cachedMetrics.timestamp };
        let hasAll = false;
        for (const m of metrics) {
          if (m === 'all') {
            hasAll = true;
            break;
          }
        }
        if (hasAll) {
          data.cpu = cachedMetrics.cpu;
          data.memory = cachedMetrics.memory;
          data.disk = cachedMetrics.disk;
          data.uptime = cachedMetrics.uptime;
        } else {
          for (const m of metrics) {
            if (cachedMetrics[m]) {
              data[m] = cachedMetrics[m];
            }
          }
        }
        ws.send(JSON.stringify(data));
      } else { // unsubscribe
        for (const m of metrics) {
          subscribedTo.delete(m);
        }
        ws.send(JSON.stringify({
          event: 'ack',
          action: 'unsubscribe',
          metrics,
          subscribedTo: Array.from(subscribedTo)
        }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON' }));
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});