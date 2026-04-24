import express from 'express';
import os from 'os';
import { execSync } from 'child_process';
import { WebSocketServer } from 'ws';

const serverApp = express();
const SERVER_PORT = process.env.PORT || 3000;

// Middleware to set Content-Type for JSON responses
serverApp.use(express.json());
serverApp.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Metrics caches
let cpuMetricsCache = null;
let memoryMetricsCache = null;
let diskMetricsCache = null;
let uptimeMetricsCache = null;
let previousCpuTimes = os.cpus();

// Helper function to format uptime
function formatSystemUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
}

// Collect metrics function
function gatherMetrics() {
  const timestamp = new Date().toISOString();

  // CPU metrics
  const currentCpuTimes = os.cpus();
  const numCpuCores = currentCpuTimes.length;
  let totalDeltaTotal = 0;
  let totalDeltaIdle = 0;

  for (let i = 0; i < numCpuCores; i++) {
    const prev = previousCpuTimes[i].times;
    const curr = currentCpuTimes[i].times;

    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;

    const deltaTotal = currTotal - prevTotal;
    const deltaIdle = curr.idle - prev.idle;

    totalDeltaTotal += deltaTotal;
    totalDeltaIdle += deltaIdle;
  }

  const usagePercent = totalDeltaTotal > 0 ? ((totalDeltaTotal - totalDeltaIdle) / totalDeltaTotal) * 100 : 0;
  const idlePercent = totalDeltaTotal > 0 ? (totalDeltaIdle / totalDeltaTotal) * 100 : 0;

  cpuMetricsCache = {
    timestamp,
    data: {
      model: currentCpuTimes[0].model,
      cores: numCpuCores,
      idlePercent: Math.round(idlePercent * 100) / 100,
      usagePercent: Math.round(usagePercent * 100) / 100,
      loadAverage: os.loadavg()
    }
  };

  previousCpuTimes = currentCpuTimes;

  // Memory metrics
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercentMem = (usedBytes / totalBytes) * 100;

  memoryMetricsCache = {
    timestamp,
    data: {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent: Math.round(usagePercentMem * 100) / 100,
      totalMB: Math.round(totalBytes / (1024 * 1024)),
      freeMB: Math.round(freeBytes / (1024 * 1024)),
      usedMB: Math.round(usedBytes / (1024 * 1024))
    }
  };

  // Disk metrics
  let diskData;
  try {
    if (os.platform() === 'win32') {
      const output = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /value').toString();
      const sizeMatch = output.match(/Size=(\d+)/);
      const freeMatch = output.match(/FreeSpace=(\d+)/);
      if (sizeMatch && freeMatch) {
        const totalBytes = parseInt(sizeMatch[1]);
        const freeBytes = parseInt(freeMatch[1]);
        const usedBytes = totalBytes - freeBytes;
        const usagePercent = (usedBytes / totalBytes) * 100;
        diskData = {
          totalBytes,
          freeBytes,
          usedBytes,
          usagePercent: Math.round(usagePercent * 100) / 100
        };
      } else {
        throw new Error('Failed to parse disk info');
      }
    } else {
      const output = execSync('df -k /').toString();
      const lines = output.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const parts = lastLine.split(/\s+/);
      const totalKB = parseInt(parts[1]) * 1024;
      const usedKB = parseInt(parts[2]) * 1024;
      const freeKB = parseInt(parts[3]) * 1024;
      const usagePercent = parseFloat(parts[4].replace('%', ''));
      diskData = {
        totalBytes: totalKB,
        freeBytes: freeKB,
        usedBytes: usedKB,
        usagePercent
      };
    }
  } catch (err) {
    diskData = { error: err.message };
  }
  diskMetricsCache = { timestamp, data: diskData };

  // Uptime metrics
  const uptimeSeconds = os.uptime();
  const processUptimeSeconds = process.uptime();
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const formatted = formatSystemUptime(uptimeSeconds);

  uptimeMetricsCache = {
    timestamp,
    data: {
      uptimeSeconds,
      formatted,
      processUptimeSeconds,
      hostname,
      platform,
      arch
    }
  };

  // Broadcast to subscribed clients
  for (const client of connectedClients) {
    if (client.subscribedTo && client.subscribedTo.length > 0) {
      const snapshot = { timestamp };
      const cacheMap = { cpu: cpuMetricsCache, memory: memoryMetricsCache, disk: diskMetricsCache, uptime: uptimeMetricsCache };
      for (const type of client.subscribedTo) {
        if (cacheMap[type]) {
          snapshot[type] = cacheMap[type].data;
        }
      }
      try {
        client.send(JSON.stringify(snapshot));
      } catch (err) {
        // Client may have disconnected, will be removed on close
      }
    }
  }
}

// Start metrics collection
setInterval(gatherMetrics, 1000);

// Health check endpoint
serverApp.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Metrics endpoints
const validMetricTypes = ['cpu', 'memory', 'disk', 'uptime'];

serverApp.get('/metrics', (req, res) => {
  if (!cpuMetricsCache || !memoryMetricsCache || !diskMetricsCache || !uptimeMetricsCache) {
    return res.status(503).json({ error: 'Metrics not yet available' });
  }
  res.json({
    timestamp: cpuMetricsCache.timestamp,
    cpu: cpuMetricsCache.data,
    memory: memoryMetricsCache.data,
    disk: diskMetricsCache.data,
    uptime: uptimeMetricsCache.data
  });
});

serverApp.get('/metrics/:type', (req, res) => {
  const { type } = req.params;
  if (!validMetricTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid metric type: ${type}` });
  }
  const cache = { cpu: cpuMetricsCache, memory: memoryMetricsCache, disk: diskMetricsCache, uptime: uptimeMetricsCache }[type];
  if (!cache) {
    return res.status(503).json({ error: 'Metrics not yet available' });
  }
  res.json({ type, timestamp: cache.timestamp, data: cache.data });
});

// Catch-all for unknown routes
serverApp.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const httpServer = serverApp.listen(SERVER_PORT, () => {
  console.log(`Resource Monitor Server v2 is running on port ${SERVER_PORT}`);
});

// WebSocket server
const connectedClients = new Set();
const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: (info) => info.req.url.startsWith('/ws')
});

wss.on('connection', (ws, req) => {
  connectedClients.add(ws);
  const path = req.url;
  let subscribedTo = [];
  if (path === '/ws/cpu') {
    subscribedTo = ['cpu'];
  } else if (path === '/ws/memory') {
    subscribedTo = ['memory'];
  } else if (path === '/ws/disk') {
    subscribedTo = ['disk'];
  } else if (path === '/ws/uptime') {
    subscribedTo = ['uptime'];
  } else if (path === '/ws/all') {
    subscribedTo = ['cpu', 'memory', 'disk', 'uptime'];
  }
  // /ws has []

  ws.subscribedTo = subscribedTo;

  ws.send(JSON.stringify({
    event: 'connected',
    subscribedTo,
    validTypes: ['all', 'cpu', 'memory', 'disk', 'uptime']
  }));

  if (subscribedTo.length > 0) {
    const snapshot = { timestamp: cpuMetricsCache ? cpuMetricsCache.timestamp : new Date().toISOString() };
    const cacheMap = { cpu: cpuMetricsCache, memory: memoryMetricsCache, disk: diskMetricsCache, uptime: uptimeMetricsCache };
    for (const type of subscribedTo) {
      if (cacheMap[type]) {
        snapshot[type] = cacheMap[type].data;
      }
    }
    ws.send(JSON.stringify(snapshot));
  }

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON received' }));
      return;
    }

    if (!msg.action) {
      ws.send(JSON.stringify({ event: 'error', message: 'Missing action field' }));
      return;
    }

    if (msg.action !== 'subscribe' && msg.action !== 'unsubscribe') {
      ws.send(JSON.stringify({ event: 'error', message: `Unknown action: ${msg.action}` }));
      return;
    }

    if (!msg.metrics) {
      ws.send(JSON.stringify({ event: 'error', message: 'Missing metrics field' }));
      return;
    }

    if (!Array.isArray(msg.metrics)) {
      ws.send(JSON.stringify({ event: 'error', message: 'Metrics must be an array' }));
      return;
    }

    if (msg.metrics.length === 0) {
      ws.send(JSON.stringify({ event: 'error', message: 'Metrics array cannot be empty' }));
      return;
    }

    const validTypes = ['cpu', 'memory', 'disk', 'uptime', 'all'];
    for (const type of msg.metrics) {
      if (!validTypes.includes(type)) {
        ws.send(JSON.stringify({ event: 'error', message: `Unknown metric type: '${type}'` }));
        return;
      }
    }

    // Proceed with action
    const validMetricTypes = ['cpu', 'memory', 'disk', 'uptime'];
    if (msg.action === 'subscribe') {
      let toAdd = msg.metrics.slice(); // copy
      if (toAdd.includes('all')) {
        toAdd = ['cpu', 'memory', 'disk', 'uptime'];
      }
      const added = [];
      for (const type of toAdd) {
        if (validMetricTypes.includes(type) && !ws.subscribedTo.includes(type)) {
          ws.subscribedTo.push(type);
          added.push(type);
        }
      }
      ws.send(JSON.stringify({
        event: 'ack',
        action: 'subscribe',
        metrics: added,
        subscribedTo: ws.subscribedTo
      }));
      if (added.length > 0) {
        const snapshot = { timestamp: cpuMetricsCache ? cpuMetricsCache.timestamp : new Date().toISOString() };
        const cacheMap = { cpu: cpuMetricsCache, memory: memoryMetricsCache, disk: diskMetricsCache, uptime: uptimeMetricsCache };
        for (const type of added) {
          if (cacheMap[type]) {
            snapshot[type] = cacheMap[type].data;
          }
        }
        ws.send(JSON.stringify(snapshot));
      }
    } else if (msg.action === 'unsubscribe') {
      const toRemove = msg.metrics;
      const removed = [];
      ws.subscribedTo = ws.subscribedTo.filter(type => {
        if (toRemove.includes(type)) {
          removed.push(type);
          return false;
        }
        return true;
      });
      ws.send(JSON.stringify({
        event: 'ack',
        action: 'unsubscribe',
        metrics: removed,
        subscribedTo: ws.subscribedTo
      }));
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
  });
});