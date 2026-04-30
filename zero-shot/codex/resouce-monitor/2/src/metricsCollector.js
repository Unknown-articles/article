import fs from 'node:fs/promises';
import os from 'node:os';

const BYTE_TO_MB = 1024 * 1024;
const METRIC_TYPES = Object.freeze(['cpu', 'memory', 'disk', 'uptime']);
const VALID_TYPES = Object.freeze(['all', ...METRIC_TYPES]);
const COLLECTION_INTERVAL_MS = 1000;

let latestSnapshot = null;
let lastCpuTimes = null;
let inFlightCollection = null;

function round(value, precision = 2) {
  return Number(value.toFixed(precision));
}

function getCpuTotals() {
  return os.cpus().map((cpu) => {
    const idle = cpu.times.idle;
    const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    return { idle, total };
  });
}

function collectCpu() {
  const cpus = os.cpus();
  const currentCpuTimes = getCpuTotals();
  const previousCpuTimes = lastCpuTimes ?? currentCpuTimes.map(() => ({ idle: 0, total: 0 }));

  let idleDelta = 0;
  let totalDelta = 0;

  for (const [index, current] of currentCpuTimes.entries()) {
    const previous = previousCpuTimes[index] ?? { idle: 0, total: 0 };
    idleDelta += Math.max(current.idle - previous.idle, 0);
    totalDelta += Math.max(current.total - previous.total, 0);
  }

  lastCpuTimes = currentCpuTimes;

  const idlePercent = totalDelta > 0 ? round((idleDelta / totalDelta) * 100) : 0;
  const usagePercent = round(100 - idlePercent);

  return {
    model: cpus[0]?.model ?? 'unknown',
    cores: cpus.length,
    idlePercent,
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
    totalMB: round(totalBytes / BYTE_TO_MB),
    freeMB: round(freeBytes / BYTE_TO_MB),
    usedMB: round(usedBytes / BYTE_TO_MB)
  };
}

async function collectDisk() {
  try {
    const stats = await fs.statfs('/');
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
      error: `Disk metrics are unavailable: ${error.message}`
    };
  }
}

function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function collectUptime() {
  const uptimeSeconds = os.uptime();

  return {
    uptimeSeconds,
    formatted: formatUptime(uptimeSeconds),
    processUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

async function collectSnapshot() {
  if (inFlightCollection) {
    return inFlightCollection;
  }

  inFlightCollection = doCollectSnapshot();

  try {
    return await inFlightCollection;
  } finally {
    inFlightCollection = null;
  }
}

async function doCollectSnapshot() {
  latestSnapshot = {
    timestamp: new Date().toISOString(),
    cpu: collectCpu(),
    memory: collectMemory(),
    disk: await collectDisk(),
    uptime: collectUptime()
  };

  return latestSnapshot;
}

function getLatestSnapshot() {
  return latestSnapshot;
}

async function ensureInitialSnapshot() {
  if (!latestSnapshot) {
    await collectSnapshot();
  }

  return latestSnapshot;
}

function startMetricsCollector(onSnapshot) {
  let collecting = false;

  const runCollection = async () => {
    if (collecting) {
      return;
    }

    collecting = true;

    try {
      const snapshot = await collectSnapshot();
      onSnapshot?.(snapshot);
    } finally {
      collecting = false;
    }
  };

  void runCollection();
  const interval = setInterval(runCollection, COLLECTION_INTERVAL_MS);

  return {
    stop() {
      clearInterval(interval);
    }
  };
}

export {
  COLLECTION_INTERVAL_MS,
  METRIC_TYPES,
  VALID_TYPES,
  ensureInitialSnapshot,
  getLatestSnapshot,
  startMetricsCollector
};
