import express from 'express';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import os from 'node:os';
import { WebSocket, WebSocketServer } from 'ws';

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;
const megabyte = 1024 * 1024;
const collectionIntervalMs = 1000;
const validMetricTypes = new Set(['cpu', 'memory', 'disk', 'uptime']);
const allMetricTypes = ['cpu', 'memory', 'disk', 'uptime'];
const validWebSocketTypes = ['all', 'cpu', 'memory', 'disk', 'uptime'];
const clients = new Set();
const webSocketServer = new WebSocketServer({ noServer: true });

let previousCpuReading = os.cpus();
let latestSnapshot = collectMetricsSnapshot();

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

function getCpuTimes(cpus) {
  return cpus.reduce(
    (totals, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);

      totals.idle += cpu.times.idle;
      totals.total += total;

      return totals;
    },
    { idle: 0, total: 0 },
  );
}

function collectCpuMetrics() {
  const currentCpuReading = os.cpus();
  const previousTimes = getCpuTimes(previousCpuReading);
  const currentTimes = getCpuTimes(currentCpuReading);
  const idleDelta = currentTimes.idle - previousTimes.idle;
  const totalDelta = currentTimes.total - previousTimes.total;
  const idlePercent = totalDelta > 0 ? roundToTwoDecimals((idleDelta / totalDelta) * 100) : 0;

  previousCpuReading = currentCpuReading;

  return {
    model: currentCpuReading[0]?.model ?? 'unknown',
    cores: currentCpuReading.length,
    idlePercent,
    usagePercent: roundToTwoDecimals(100 - idlePercent),
    loadAverage: os.loadavg(),
  };
}

function collectMemoryMetrics() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: roundToTwoDecimals((usedBytes / totalBytes) * 100),
    totalMB: roundToTwoDecimals(totalBytes / megabyte),
    freeMB: roundToTwoDecimals(freeBytes / megabyte),
    usedMB: roundToTwoDecimals(usedBytes / megabyte),
  };
}

function collectDiskMetrics() {
  if (process.platform === 'win32') {
    return collectWindowsDiskMetrics();
  }

  return collectUnixDiskMetrics();
}

function collectUnixDiskMetrics() {
  try {
    const output = execFileSync('df', ['-kP', '/'], { encoding: 'utf8' });
    const line = output.trim().split('\n')[1];

    if (!line) {
      return { error: 'Disk information was not available from df.' };
    }

    const parts = line.trim().split(/\s+/);
    const totalBytes = Number(parts[1]) * 1024;
    const usedBytes = Number(parts[2]) * 1024;
    const freeBytes = Number(parts[3]) * 1024;

    if (![totalBytes, usedBytes, freeBytes].every(Number.isFinite)) {
      return { error: 'Disk information from df could not be parsed.' };
    }

    return {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent: roundToTwoDecimals((usedBytes / totalBytes) * 100),
    };
  } catch (error) {
    return { error: `Disk information could not be read: ${error.message}` };
  }
}

function collectWindowsDiskMetrics() {
  try {
    const drive = process.cwd().slice(0, 1);
    const command = [
      `Get-PSDrive -Name '${drive}'`,
      '| Select-Object -First 1 Used,Free',
      '| ConvertTo-Json -Compress',
    ].join(' ');
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
      encoding: 'utf8',
    }).trim();

    if (!output) {
      return { error: `Disk information was not available for ${drive}.` };
    }

    const disk = JSON.parse(output);
    const usedBytes = Number(disk.Used);
    const freeBytes = Number(disk.Free);
    const totalBytes = usedBytes + freeBytes;

    if (![totalBytes, freeBytes, usedBytes].every(Number.isFinite)) {
      return { error: 'Disk information from PowerShell could not be parsed.' };
    }

    return {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent: roundToTwoDecimals((usedBytes / totalBytes) * 100),
    };
  } catch (error) {
    return { error: `Disk information could not be read: ${error.message}` };
  }
}

function formatUptime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0 || parts.length > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || parts.length > 0) {
    parts.push(`${minutes}m`);
  }

  parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}

function collectUptimeMetrics() {
  const uptimeSeconds = os.uptime();

  return {
    uptimeSeconds,
    formatted: formatUptime(uptimeSeconds),
    processUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

function collectMetricsSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    cpu: collectCpuMetrics(),
    memory: collectMemoryMetrics(),
    disk: collectDiskMetrics(),
    uptime: collectUptimeMetrics(),
  };
}

function getSubscriptionsFromPath(pathname) {
  if (pathname === '/ws') {
    return new Set();
  }

  const requestedType = pathname.slice('/ws/'.length);

  if (requestedType === 'all') {
    return new Set(allMetricTypes);
  }

  if (validMetricTypes.has(requestedType)) {
    return new Set([requestedType]);
  }

  return new Set();
}

function orderMetrics(metrics) {
  const metricSet = new Set(metrics);

  return allMetricTypes.filter((type) => metricSet.has(type));
}

function expandRequestedMetrics(metrics) {
  const expanded = metrics.flatMap((type) => (type === 'all' ? allMetricTypes : [type]));
  return orderMetrics(expanded.filter((type) => validMetricTypes.has(type)));
}

function getUnknownMetricTypes(metrics) {
  return metrics.filter((type) => !validWebSocketTypes.includes(type));
}

function buildSubscriptionSnapshot(snapshot, subscribedTo) {
  return orderMetrics(subscribedTo).reduce(
    (filteredSnapshot, type) => ({
      ...filteredSnapshot,
      [type]: snapshot[type],
    }),
    { timestamp: snapshot.timestamp },
  );
}

function broadcastMetricsSnapshot(snapshot) {
  for (const client of clients) {
    if (client.subscribedTo.size === 0) {
      continue;
    }

    if (client.webSocket.readyState !== WebSocket.OPEN) {
      clients.delete(client);
      continue;
    }

    client.webSocket.send(JSON.stringify(buildSubscriptionSnapshot(snapshot, client.subscribedTo)));
  }
}

function sendClientError(client, message) {
  client.webSocket.send(
    JSON.stringify({
      event: 'error',
      message,
    }),
  );
}

function handleSubscribeMessage(client, metrics) {
  const requestedMetrics = expandRequestedMetrics(metrics);
  const addedMetrics = requestedMetrics.filter((type) => !client.subscribedTo.has(type));

  for (const type of addedMetrics) {
    client.subscribedTo.add(type);
  }

  client.webSocket.send(
    JSON.stringify({
      event: 'ack',
      action: 'subscribe',
      metrics: addedMetrics,
      subscribedTo: orderMetrics(client.subscribedTo),
    }),
  );

  if (addedMetrics.length > 0) {
    client.webSocket.send(JSON.stringify(buildSubscriptionSnapshot(latestSnapshot, addedMetrics)));
  }
}

function handleUnsubscribeMessage(client, metrics) {
  const requestedMetrics = expandRequestedMetrics(metrics);
  const removedMetrics = requestedMetrics.filter((type) => client.subscribedTo.has(type));

  for (const type of removedMetrics) {
    client.subscribedTo.delete(type);
  }

  client.webSocket.send(
    JSON.stringify({
      event: 'ack',
      action: 'unsubscribe',
      metrics: removedMetrics,
      subscribedTo: orderMetrics(client.subscribedTo),
    }),
  );
}

function validateClientMessage(message) {
  if (message.action !== 'subscribe' && message.action !== 'unsubscribe') {
    return 'Unknown or unsupported action.';
  }

  if (!Array.isArray(message.metrics) || message.metrics.length === 0) {
    return 'At least one metric type is required.';
  }

  const unknownMetricTypes = getUnknownMetricTypes(message.metrics);

  if (unknownMetricTypes.length > 0) {
    return `Unknown metric type: '${unknownMetricTypes.join("', '")}'`;
  }

  return null;
}

function handleClientMessage(client, data) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch {
    sendClientError(client, 'Input was not valid JSON.');
    return;
  }

  const validationError = validateClientMessage(message);

  if (validationError) {
    sendClientError(client, validationError);
    return;
  }

  if (message.action === 'subscribe') {
    handleSubscribeMessage(client, message.metrics);
    return;
  }

  handleUnsubscribeMessage(client, message.metrics);
}

setInterval(() => {
  latestSnapshot = collectMetricsSnapshot();
  broadcastMetricsSnapshot(latestSnapshot);
}, collectionIntervalMs);

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname !== '/ws' && !pathname.startsWith('/ws/')) {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(req, socket, head, (webSocket) => {
    webSocketServer.emit('connection', webSocket, req);
  });
});

webSocketServer.on('connection', (webSocket, req) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const subscribedTo = getSubscriptionsFromPath(pathname);
  const client = { webSocket, subscribedTo };

  clients.add(client);

  webSocket.send(
    JSON.stringify({
      event: 'connected',
      subscribedTo: orderMetrics(subscribedTo),
      validTypes: validWebSocketTypes,
    }),
  );

  if (subscribedTo.size > 0) {
    webSocket.send(JSON.stringify(buildSubscriptionSnapshot(latestSnapshot, subscribedTo)));
  }

  webSocket.on('message', (data) => {
    handleClientMessage(client, data);
  });

  webSocket.on('close', () => {
    clients.delete(client);
  });

  webSocket.on('error', () => {
    clients.delete(client);
  });
});

app.use((req, res, next) => {
  res.type('application/json');
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', (req, res) => {
  res.status(200).json(latestSnapshot);
});

app.get('/metrics/:type', (req, res) => {
  const { type } = req.params;

  if (!validMetricTypes.has(type)) {
    res.status(400).json({ error: `Unsupported metric type: ${type}` });
    return;
  }

  res.status(200).json({
    type,
    timestamp: latestSnapshot.timestamp,
    data: latestSnapshot[type],
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
