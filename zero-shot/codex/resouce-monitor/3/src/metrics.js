import fs from 'node:fs/promises';
import os from 'node:os';

export const METRIC_TYPES = ['cpu', 'memory', 'disk', 'uptime'];
export const VALID_STREAM_TYPES = ['all', ...METRIC_TYPES];
export const COLLECTION_INTERVAL_MS = 1000;

let latestSnapshot = null;
let previousCpuTimes = readCpuTimes();
let collectionTimer = null;

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function bytesToMB(bytes) {
  return round(bytes / 1024 / 1024);
}

function readCpuTimes() {
  const cpus = os.cpus();
  const totals = cpus.reduce(
    (acc, cpu) => {
      const idle = cpu.times.idle;
      const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
      acc.idle += idle;
      acc.total += total;
      return acc;
    },
    { idle: 0, total: 0 }
  );

  return { cpus, ...totals };
}

function collectCpu() {
  const currentCpuTimes = readCpuTimes();
  const idleDelta = currentCpuTimes.idle - previousCpuTimes.idle;
  const totalDelta = currentCpuTimes.total - previousCpuTimes.total;
  const idlePercent = totalDelta > 0 ? round((idleDelta / totalDelta) * 100) : 0;
  const usagePercent = round(Math.max(0, Math.min(100, 100 - idlePercent)));

  previousCpuTimes = currentCpuTimes;

  return {
    model: currentCpuTimes.cpus[0]?.model ?? 'unknown',
    cores: currentCpuTimes.cpus.length,
    idlePercent: round(Math.max(0, Math.min(100, idlePercent))),
    usagePercent,
    loadAverage: os.loadavg()
  };
}

function collectMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: round((usedBytes / totalBytes) * 100),
    totalMB: bytesToMB(totalBytes),
    freeMB: bytesToMB(freeBytes),
    usedMB: bytesToMB(usedBytes)
  };
}

async function collectDisk() {
  try {
    const stats = await fs.statfs(process.cwd());
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    const usedBytes = totalBytes - freeBytes;

    return {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent: totalBytes > 0 ? round((usedBytes / totalBytes) * 100) : 0
    };
  } catch (error) {
    return {
      error: `Disk information unavailable: ${error.message}`
    };
  }
}

function formatUptime(totalSeconds) {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / 3600) % 24);
  const days = Math.floor(totalSeconds / 86400);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || parts.length > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

function collectUptime() {
  const uptimeSeconds = os.uptime();

  return {
    uptimeSeconds,
    formatted: formatUptime(uptimeSeconds),
    processUptimeSeconds: round(process.uptime()),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

export async function collectMetricsSnapshot() {
  const [disk] = await Promise.all([collectDisk()]);

  latestSnapshot = {
    timestamp: new Date().toISOString(),
    cpu: collectCpu(),
    memory: collectMemory(),
    disk,
    uptime: collectUptime()
  };

  return latestSnapshot;
}

export function getLatestSnapshot() {
  return latestSnapshot;
}

export function pickMetrics(snapshot, subscriptions) {
  const selectedTypes = subscriptions.has('all') ? METRIC_TYPES : METRIC_TYPES.filter((type) => subscriptions.has(type));
  const payload = { timestamp: snapshot.timestamp };

  for (const type of selectedTypes) {
    payload[type] = snapshot[type];
  }

  return payload;
}

export async function startMetricsCollection(onSnapshot) {
  if (collectionTimer) {
    return latestSnapshot;
  }

  await collectMetricsSnapshot();

  collectionTimer = setInterval(async () => {
    const snapshot = await collectMetricsSnapshot();
    onSnapshot?.(snapshot);
  }, COLLECTION_INTERVAL_MS);

  collectionTimer.unref?.();
  return latestSnapshot;
}
