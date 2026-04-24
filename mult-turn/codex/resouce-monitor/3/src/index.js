import express from 'express';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import os from 'node:os';
import { WebSocket, WebSocketServer } from 'ws';

const service = express();
const backend = createServer(service);
const servicePort = process.env.PORT || 3000;
const mbFactor = 1024 * 1024;
const pollingDelay = 1000;
const metricNames = ['cpu', 'memory', 'disk', 'uptime'];
const allowedRouteMetrics = new Set(metricNames);
const allowedRealtimeMetrics = ['all', 'cpu', 'memory', 'disk', 'uptime'];
const sessionPool = new Set();
const realtimeServer = new WebSocketServer({ noServer: true });

let cpuBaseline = os.cpus();
let currentReport = generateReport();

function trimNumber(value) {
  return Math.round(value * 100) / 100;
}

function accumulateCpuWindows(cpuEntries) {
  return cpuEntries.reduce(
    (windowTotals, unit) => {
      const unitTotal = Object.values(unit.times).reduce((total, slice) => total + slice, 0);

      windowTotals.idle += unit.times.idle;
      windowTotals.total += unitTotal;

      return windowTotals;
    },
    { idle: 0, total: 0 },
  );
}

function sampleCpu() {
  const freshCpuState = os.cpus();
  const baselineWindow = accumulateCpuWindows(cpuBaseline);
  const freshWindow = accumulateCpuWindows(freshCpuState);
  const idleDiff = freshWindow.idle - baselineWindow.idle;
  const totalDiff = freshWindow.total - baselineWindow.total;
  const idleShare = totalDiff > 0 ? trimNumber((idleDiff / totalDiff) * 100) : 0;

  cpuBaseline = freshCpuState;

  return {
    model: freshCpuState[0]?.model ?? 'unknown',
    cores: freshCpuState.length,
    idlePercent: idleShare,
    usagePercent: trimNumber(100 - idleShare),
    loadAverage: os.loadavg(),
  };
}

function sampleMemory() {
  const installedBytes = os.totalmem();
  const spareBytes = os.freemem();
  const busyBytes = installedBytes - spareBytes;

  return {
    totalBytes: installedBytes,
    freeBytes: spareBytes,
    usedBytes: busyBytes,
    usagePercent: trimNumber((busyBytes / installedBytes) * 100),
    totalMB: trimNumber(installedBytes / mbFactor),
    freeMB: trimNumber(spareBytes / mbFactor),
    usedMB: trimNumber(busyBytes / mbFactor),
  };
}

function sampleDisk() {
  if (process.platform === 'win32') {
    return sampleWindowsDisk();
  }

  return sampleUnixDisk();
}

function sampleUnixDisk() {
  try {
    const dfResult = execFileSync('df', ['-kP', '/'], { encoding: 'utf8' });
    const rootEntry = dfResult.trim().split('\n')[1];

    if (!rootEntry) {
      return { error: 'Disk information was not available from df.' };
    }

    const fields = rootEntry.trim().split(/\s+/);
    const diskTotal = Number(fields[1]) * 1024;
    const diskUsed = Number(fields[2]) * 1024;
    const diskFree = Number(fields[3]) * 1024;

    if (![diskTotal, diskUsed, diskFree].every(Number.isFinite)) {
      return { error: 'Disk information from df could not be parsed.' };
    }

    return {
      totalBytes: diskTotal,
      freeBytes: diskFree,
      usedBytes: diskUsed,
      usagePercent: trimNumber((diskUsed / diskTotal) * 100),
    };
  } catch (issue) {
    return { error: `Disk information could not be read: ${issue.message}` };
  }
}

function sampleWindowsDisk() {
  try {
    const activeDrive = process.cwd().slice(0, 1);
    const psPipeline = [
      `Get-PSDrive -Name '${activeDrive}'`,
      '| Select-Object -First 1 Used,Free',
      '| ConvertTo-Json -Compress',
    ].join(' ');
    const rawDrive = execFileSync('powershell.exe', ['-NoProfile', '-Command', psPipeline], {
      encoding: 'utf8',
    }).trim();

    if (!rawDrive) {
      return { error: `Disk information was not available for ${activeDrive}.` };
    }

    const driveStats = JSON.parse(rawDrive);
    const diskUsed = Number(driveStats.Used);
    const diskFree = Number(driveStats.Free);
    const diskTotal = diskUsed + diskFree;

    if (![diskTotal, diskFree, diskUsed].every(Number.isFinite)) {
      return { error: 'Disk information from PowerShell could not be parsed.' };
    }

    return {
      totalBytes: diskTotal,
      freeBytes: diskFree,
      usedBytes: diskUsed,
      usagePercent: trimNumber((diskUsed / diskTotal) * 100),
    };
  } catch (issue) {
    return { error: `Disk information could not be read: ${issue.message}` };
  }
}

function humanizeUptime(runtimeSeconds) {
  const totalSeconds = Math.floor(runtimeSeconds);
  const totalDays = Math.floor(totalSeconds / 86400);
  const totalHours = Math.floor((totalSeconds % 86400) / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
  const secondsLeft = totalSeconds % 60;
  const chunks = [];

  if (totalDays > 0) {
    chunks.push(`${totalDays}d`);
  }

  if (totalHours > 0 || chunks.length > 0) {
    chunks.push(`${totalHours}h`);
  }

  if (totalMinutes > 0 || chunks.length > 0) {
    chunks.push(`${totalMinutes}m`);
  }

  chunks.push(`${secondsLeft}s`);

  return chunks.join(' ');
}

function sampleUptime() {
  const osUptimeSeconds = os.uptime();

  return {
    uptimeSeconds: osUptimeSeconds,
    formatted: humanizeUptime(osUptimeSeconds),
    processUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

function generateReport() {
  return {
    timestamp: new Date().toISOString(),
    cpu: sampleCpu(),
    memory: sampleMemory(),
    disk: sampleDisk(),
    uptime: sampleUptime(),
  };
}

function parseSocketPreset(urlPath) {
  if (urlPath === '/ws') {
    return new Set();
  }

  const requestedMetric = urlPath.slice('/ws/'.length);

  if (requestedMetric === 'all') {
    return new Set(metricNames);
  }

  if (allowedRouteMetrics.has(requestedMetric)) {
    return new Set([requestedMetric]);
  }

  return new Set();
}

function arrangeMetrics(selection) {
  const selectionSet = new Set(selection);
  return metricNames.filter((metric) => selectionSet.has(metric));
}

function expandMetricSelection(selection) {
  const explodedSelection = selection.flatMap((metric) => (metric === 'all' ? metricNames : [metric]));
  return arrangeMetrics(explodedSelection.filter((metric) => allowedRouteMetrics.has(metric)));
}

function detectUnsupportedMetrics(selection) {
  return selection.filter((metric) => !allowedRealtimeMetrics.includes(metric));
}

function projectReport(report, selection) {
  return arrangeMetrics(selection).reduce(
    (payload, metric) => ({
      ...payload,
      [metric]: report[metric],
    }),
    { timestamp: report.timestamp },
  );
}

function streamReport(report) {
  for (const session of sessionPool) {
    if (session.trackedMetrics.size === 0) {
      continue;
    }

    if (session.channel.readyState !== WebSocket.OPEN) {
      sessionPool.delete(session);
      continue;
    }

    session.channel.send(JSON.stringify(projectReport(report, session.trackedMetrics)));
  }
}

function notifySessionError(session, details) {
  session.channel.send(
    JSON.stringify({
      event: 'error',
      message: details,
    }),
  );
}

function attachMetrics(session, metrics) {
  const normalizedMetrics = expandMetricSelection(metrics);
  const addedMetrics = normalizedMetrics.filter((metric) => !session.trackedMetrics.has(metric));

  for (const metric of addedMetrics) {
    session.trackedMetrics.add(metric);
  }

  session.channel.send(
    JSON.stringify({
      event: 'ack',
      action: 'subscribe',
      metrics: addedMetrics,
      subscribedTo: arrangeMetrics(session.trackedMetrics),
    }),
  );

  if (addedMetrics.length > 0) {
    session.channel.send(JSON.stringify(projectReport(currentReport, addedMetrics)));
  }
}

function detachMetrics(session, metrics) {
  const normalizedMetrics = expandMetricSelection(metrics);
  const removedMetrics = normalizedMetrics.filter((metric) => session.trackedMetrics.has(metric));

  for (const metric of removedMetrics) {
    session.trackedMetrics.delete(metric);
  }

  session.channel.send(
    JSON.stringify({
      event: 'ack',
      action: 'unsubscribe',
      metrics: removedMetrics,
      subscribedTo: arrangeMetrics(session.trackedMetrics),
    }),
  );
}

function validateRealtimeMessage(payload) {
  if (payload.action !== 'subscribe' && payload.action !== 'unsubscribe') {
    return 'Unknown or unsupported action.';
  }

  if (!Array.isArray(payload.metrics) || payload.metrics.length === 0) {
    return 'At least one metric type is required.';
  }

  const unsupportedMetrics = detectUnsupportedMetrics(payload.metrics);

  if (unsupportedMetrics.length > 0) {
    return `Unknown metric type: '${unsupportedMetrics.join("', '")}'`;
  }

  return null;
}

function processRealtimeMessage(session, input) {
  let payload;

  try {
    payload = JSON.parse(input.toString());
  } catch {
    notifySessionError(session, 'Input was not valid JSON.');
    return;
  }

  const payloadError = validateRealtimeMessage(payload);

  if (payloadError) {
    notifySessionError(session, payloadError);
    return;
  }

  if (payload.action === 'subscribe') {
    attachMetrics(session, payload.metrics);
    return;
  }

  detachMetrics(session, payload.metrics);
}

setInterval(() => {
  currentReport = generateReport();
  streamReport(currentReport);
}, pollingDelay);

backend.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  if (pathname !== '/ws' && !pathname.startsWith('/ws/')) {
    socket.destroy();
    return;
  }

  realtimeServer.handleUpgrade(request, socket, head, (channel) => {
    realtimeServer.emit('connection', channel, request);
  });
});

realtimeServer.on('connection', (channel, request) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  const trackedMetrics = parseSocketPreset(pathname);
  const session = { channel, trackedMetrics };

  sessionPool.add(session);

  channel.send(
    JSON.stringify({
      event: 'connected',
      subscribedTo: arrangeMetrics(trackedMetrics),
      validTypes: allowedRealtimeMetrics,
    }),
  );

  if (trackedMetrics.size > 0) {
    channel.send(JSON.stringify(projectReport(currentReport, trackedMetrics)));
  }

  channel.on('message', (input) => {
    processRealtimeMessage(session, input);
  });

  channel.on('close', () => {
    sessionPool.delete(session);
  });

  channel.on('error', () => {
    sessionPool.delete(session);
  });
});

service.use((request, response, next) => {
  response.type('application/json');
  next();
});

service.get('/health', (request, response) => {
  response.status(200).json({ status: 'ok' });
});

service.get('/metrics', (request, response) => {
  response.status(200).json(currentReport);
});

service.get('/metrics/:type', (request, response) => {
  const { type } = request.params;

  if (!allowedRouteMetrics.has(type)) {
    response.status(400).json({ error: `Unsupported metric type: ${type}` });
    return;
  }

  response.status(200).json({
    type,
    timestamp: currentReport.timestamp,
    data: currentReport[type],
  });
});

service.use((request, response) => {
  response.status(404).json({ error: 'Not Found' });
});

backend.listen(servicePort, () => {
  console.log(`Server listening on port ${servicePort}`);
});
