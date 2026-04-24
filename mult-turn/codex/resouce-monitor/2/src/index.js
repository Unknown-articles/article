import express from 'express';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import os from 'node:os';
import { WebSocket, WebSocketServer } from 'ws';

const api = express();
const httpServer = createServer(api);
const listeningPort = process.env.PORT || 3000;
const bytesPerMegabyte = 1024 * 1024;
const refreshRateMs = 1000;
const metricCatalog = ['cpu', 'memory', 'disk', 'uptime'];
const acceptedMetricKinds = new Set(metricCatalog);
const acceptedSocketKinds = ['all', ...metricCatalog];
const liveConnections = new Set();
const socketHub = new WebSocketServer({ noServer: true });

let lastCpuSample = os.cpus();
let cachedMetricsBundle = buildMetricsBundle();

function withTwoDecimals(number) {
  return Math.round(number * 100) / 100;
}

function summarizeCpuTimes(cpuList) {
  return cpuList.reduce(
    (summary, processor) => {
      const processorTotal = Object.values(processor.times).reduce((acc, timeSlice) => acc + timeSlice, 0);

      summary.idle += processor.times.idle;
      summary.total += processorTotal;

      return summary;
    },
    { idle: 0, total: 0 },
  );
}

function readCpuUsage() {
  const currentCpuSample = os.cpus();
  const oldCpuWindow = summarizeCpuTimes(lastCpuSample);
  const newCpuWindow = summarizeCpuTimes(currentCpuSample);
  const idleGap = newCpuWindow.idle - oldCpuWindow.idle;
  const totalGap = newCpuWindow.total - oldCpuWindow.total;
  const idleRate = totalGap > 0 ? withTwoDecimals((idleGap / totalGap) * 100) : 0;

  lastCpuSample = currentCpuSample;

  return {
    model: currentCpuSample[0]?.model ?? 'unknown',
    cores: currentCpuSample.length,
    idlePercent: idleRate,
    usagePercent: withTwoDecimals(100 - idleRate),
    loadAverage: os.loadavg(),
  };
}

function readMemoryUsage() {
  const memoryCapacity = os.totalmem();
  const availableMemory = os.freemem();
  const occupiedMemory = memoryCapacity - availableMemory;

  return {
    totalBytes: memoryCapacity,
    freeBytes: availableMemory,
    usedBytes: occupiedMemory,
    usagePercent: withTwoDecimals((occupiedMemory / memoryCapacity) * 100),
    totalMB: withTwoDecimals(memoryCapacity / bytesPerMegabyte),
    freeMB: withTwoDecimals(availableMemory / bytesPerMegabyte),
    usedMB: withTwoDecimals(occupiedMemory / bytesPerMegabyte),
  };
}

function readDiskUsage() {
  return process.platform === 'win32' ? readWindowsDriveUsage() : readUnixDriveUsage();
}

function readUnixDriveUsage() {
  try {
    const rawResult = execFileSync('df', ['-kP', '/'], { encoding: 'utf8' });
    const mainLine = rawResult.trim().split('\n')[1];

    if (!mainLine) {
      return { error: 'Disk information was not available from df.' };
    }

    const columns = mainLine.trim().split(/\s+/);
    const capacityBytes = Number(columns[1]) * 1024;
    const consumedBytes = Number(columns[2]) * 1024;
    const remainingBytes = Number(columns[3]) * 1024;

    if (![capacityBytes, consumedBytes, remainingBytes].every(Number.isFinite)) {
      return { error: 'Disk information from df could not be parsed.' };
    }

    return {
      totalBytes: capacityBytes,
      freeBytes: remainingBytes,
      usedBytes: consumedBytes,
      usagePercent: withTwoDecimals((consumedBytes / capacityBytes) * 100),
    };
  } catch (failure) {
    return { error: `Disk information could not be read: ${failure.message}` };
  }
}

function readWindowsDriveUsage() {
  try {
    const driveLetter = process.cwd().slice(0, 1);
    const powershellQuery = [
      `Get-PSDrive -Name '${driveLetter}'`,
      '| Select-Object -First 1 Used,Free',
      '| ConvertTo-Json -Compress',
    ].join(' ');
    const serializedDrive = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', powershellQuery],
      { encoding: 'utf8' },
    ).trim();

    if (!serializedDrive) {
      return { error: `Disk information was not available for ${driveLetter}.` };
    }

    const parsedDrive = JSON.parse(serializedDrive);
    const consumedBytes = Number(parsedDrive.Used);
    const remainingBytes = Number(parsedDrive.Free);
    const capacityBytes = consumedBytes + remainingBytes;

    if (![capacityBytes, remainingBytes, consumedBytes].every(Number.isFinite)) {
      return { error: 'Disk information from PowerShell could not be parsed.' };
    }

    return {
      totalBytes: capacityBytes,
      freeBytes: remainingBytes,
      usedBytes: consumedBytes,
      usagePercent: withTwoDecimals((consumedBytes / capacityBytes) * 100),
    };
  } catch (failure) {
    return { error: `Disk information could not be read: ${failure.message}` };
  }
}

function describeUptime(secondsRunning) {
  const totalWholeSeconds = Math.floor(secondsRunning);
  const dayCount = Math.floor(totalWholeSeconds / 86400);
  const hourCount = Math.floor((totalWholeSeconds % 86400) / 3600);
  const minuteCount = Math.floor((totalWholeSeconds % 3600) / 60);
  const trailingSeconds = totalWholeSeconds % 60;
  const labels = [];

  if (dayCount > 0) {
    labels.push(`${dayCount}d`);
  }

  if (hourCount > 0 || labels.length > 0) {
    labels.push(`${hourCount}h`);
  }

  if (minuteCount > 0 || labels.length > 0) {
    labels.push(`${minuteCount}m`);
  }

  labels.push(`${trailingSeconds}s`);

  return labels.join(' ');
}

function readUptimeData() {
  const machineUptimeSeconds = os.uptime();

  return {
    uptimeSeconds: machineUptimeSeconds,
    formatted: describeUptime(machineUptimeSeconds),
    processUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

function buildMetricsBundle() {
  return {
    timestamp: new Date().toISOString(),
    cpu: readCpuUsage(),
    memory: readMemoryUsage(),
    disk: readDiskUsage(),
    uptime: readUptimeData(),
  };
}

function readPathSubscriptions(routePath) {
  if (routePath === '/ws') {
    return new Set();
  }

  const kindFromPath = routePath.slice('/ws/'.length);

  if (kindFromPath === 'all') {
    return new Set(metricCatalog);
  }

  if (acceptedMetricKinds.has(kindFromPath)) {
    return new Set([kindFromPath]);
  }

  return new Set();
}

function sortMetricKinds(kinds) {
  const selectedKinds = new Set(kinds);
  return metricCatalog.filter((kind) => selectedKinds.has(kind));
}

function normalizeRequestedKinds(kinds) {
  const flattenedKinds = kinds.flatMap((kind) => (kind === 'all' ? metricCatalog : [kind]));
  return sortMetricKinds(flattenedKinds.filter((kind) => acceptedMetricKinds.has(kind)));
}

function findInvalidKinds(kinds) {
  return kinds.filter((kind) => !acceptedSocketKinds.includes(kind));
}

function sliceBundleBySubscription(metricsBundle, subscribedKinds) {
  return sortMetricKinds(subscribedKinds).reduce(
    (responseBundle, kind) => ({
      ...responseBundle,
      [kind]: metricsBundle[kind],
    }),
    { timestamp: metricsBundle.timestamp },
  );
}

function publishMetricsBundle(metricsBundle) {
  for (const connection of liveConnections) {
    if (connection.subscribedKinds.size === 0) {
      continue;
    }

    if (connection.socket.readyState !== WebSocket.OPEN) {
      liveConnections.delete(connection);
      continue;
    }

    connection.socket.send(JSON.stringify(sliceBundleBySubscription(metricsBundle, connection.subscribedKinds)));
  }
}

function emitSocketError(connection, reason) {
  connection.socket.send(
    JSON.stringify({
      event: 'error',
      message: reason,
    }),
  );
}

function subscribeConnection(connection, requestedKinds) {
  const normalizedKinds = normalizeRequestedKinds(requestedKinds);
  const newlySubscribedKinds = normalizedKinds.filter((kind) => !connection.subscribedKinds.has(kind));

  for (const kind of newlySubscribedKinds) {
    connection.subscribedKinds.add(kind);
  }

  connection.socket.send(
    JSON.stringify({
      event: 'ack',
      action: 'subscribe',
      metrics: newlySubscribedKinds,
      subscribedTo: sortMetricKinds(connection.subscribedKinds),
    }),
  );

  if (newlySubscribedKinds.length > 0) {
    connection.socket.send(JSON.stringify(sliceBundleBySubscription(cachedMetricsBundle, newlySubscribedKinds)));
  }
}

function unsubscribeConnection(connection, requestedKinds) {
  const normalizedKinds = normalizeRequestedKinds(requestedKinds);
  const removedKinds = normalizedKinds.filter((kind) => connection.subscribedKinds.has(kind));

  for (const kind of removedKinds) {
    connection.subscribedKinds.delete(kind);
  }

  connection.socket.send(
    JSON.stringify({
      event: 'ack',
      action: 'unsubscribe',
      metrics: removedKinds,
      subscribedTo: sortMetricKinds(connection.subscribedKinds),
    }),
  );
}

function inspectClientPayload(payload) {
  if (payload.action !== 'subscribe' && payload.action !== 'unsubscribe') {
    return 'Unknown or unsupported action.';
  }

  if (!Array.isArray(payload.metrics) || payload.metrics.length === 0) {
    return 'At least one metric type is required.';
  }

  const invalidKinds = findInvalidKinds(payload.metrics);

  if (invalidKinds.length > 0) {
    return `Unknown metric type: '${invalidKinds.join("', '")}'`;
  }

  return null;
}

function handleIncomingPayload(connection, rawData) {
  let payload;

  try {
    payload = JSON.parse(rawData.toString());
  } catch {
    emitSocketError(connection, 'Input was not valid JSON.');
    return;
  }

  const payloadIssue = inspectClientPayload(payload);

  if (payloadIssue) {
    emitSocketError(connection, payloadIssue);
    return;
  }

  if (payload.action === 'subscribe') {
    subscribeConnection(connection, payload.metrics);
    return;
  }

  unsubscribeConnection(connection, payload.metrics);
}

setInterval(() => {
  cachedMetricsBundle = buildMetricsBundle();
  publishMetricsBundle(cachedMetricsBundle);
}, refreshRateMs);

httpServer.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  if (pathname !== '/ws' && !pathname.startsWith('/ws/')) {
    socket.destroy();
    return;
  }

  socketHub.handleUpgrade(request, socket, head, (upgradedSocket) => {
    socketHub.emit('connection', upgradedSocket, request);
  });
});

socketHub.on('connection', (socket, request) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  const subscribedKinds = readPathSubscriptions(pathname);
  const connection = { socket, subscribedKinds };

  liveConnections.add(connection);

  socket.send(
    JSON.stringify({
      event: 'connected',
      subscribedTo: sortMetricKinds(subscribedKinds),
      validTypes: acceptedSocketKinds,
    }),
  );

  if (subscribedKinds.size > 0) {
    socket.send(JSON.stringify(sliceBundleBySubscription(cachedMetricsBundle, subscribedKinds)));
  }

  socket.on('message', (rawData) => {
    handleIncomingPayload(connection, rawData);
  });

  socket.on('close', () => {
    liveConnections.delete(connection);
  });

  socket.on('error', () => {
    liveConnections.delete(connection);
  });
});

api.use((request, response, next) => {
  response.type('application/json');
  next();
});

api.get('/health', (request, response) => {
  response.status(200).json({ status: 'ok' });
});

api.get('/metrics', (request, response) => {
  response.status(200).json(cachedMetricsBundle);
});

api.get('/metrics/:type', (request, response) => {
  const { type } = request.params;

  if (!acceptedMetricKinds.has(type)) {
    response.status(400).json({ error: `Unsupported metric type: ${type}` });
    return;
  }

  response.status(200).json({
    type,
    timestamp: cachedMetricsBundle.timestamp,
    data: cachedMetricsBundle[type],
  });
});

api.use((request, response) => {
  response.status(404).json({ error: 'Not Found' });
});

httpServer.listen(listeningPort, () => {
  console.log(`Server listening on port ${listeningPort}`);
});
