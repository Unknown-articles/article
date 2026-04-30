import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import EventEmitter from 'events';

const execFileAsync = promisify(execFile);
const METRIC_TYPES = ['cpu', 'memory', 'disk', 'uptime'];
const COLLECTION_INTERVAL_MS = 1000;

let cachedSnapshot = null;
let lastCpuTimes = null;
const metricsEvents = new EventEmitter();
let collectorTimer = null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toBytes = (kilobytes) => Math.round(kilobytes * 1024);

const buildCpuTotals = (cpus) => {
  const totals = cpus.reduce(
    (acc, cpu) => {
      const cpuTimes = cpu.times;
      acc.idle += cpuTimes.idle;
      acc.total += Object.values(cpuTimes).reduce((sum, time) => sum + time, 0);
      return acc;
    },
    { idle: 0, total: 0 }
  );

  return {
    model: cpus[0]?.model || 'unknown',
    cores: cpus.length,
    totals
  };
};

const calculateCpuUsage = (previous, current) => {
  if (!previous) {
    return {
      idlePercent: 0,
      usagePercent: 0
    };
  }

  const idleDelta = current.totals.idle - previous.totals.idle;
  const totalDelta = current.totals.total - previous.totals.total;
  const usagePercent = totalDelta > 0 ? clamp(100 - (idleDelta / totalDelta) * 100, 0, 100) : 0;
  const idlePercent = clamp(100 - usagePercent, 0, 100);

  return {
    idlePercent: Number(idlePercent.toFixed(1)),
    usagePercent: Number(usagePercent.toFixed(1))
  };
};

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
};

const safePercent = (value) => Number(clamp(value, 0, 100).toFixed(1));

const getMemoryMetrics = () => {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: safePercent((usedBytes / totalBytes) * 100),
    totalMB: Number((totalBytes / 1024 / 1024).toFixed(1)),
    freeMB: Number((freeBytes / 1024 / 1024).toFixed(1)),
    usedMB: Number((usedBytes / 1024 / 1024).toFixed(1))
  };
};

const getUptimeMetrics = () => {
  const uptimeSeconds = os.uptime();

  return {
    uptimeSeconds: Number(uptimeSeconds.toFixed(1)),
    formatted: formatUptime(uptimeSeconds),
    processUptimeSeconds: Number(process.uptime().toFixed(1)),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
};

const parseDiskOutput = (stdout) => {
  const lines = stdout.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('Unexpected df output');
  }

  const row = lines[1].trim().split(/\s+/);
  if (row.length < 5) {
    throw new Error('Unable to parse disk information');
  }

  const [blocks, used, available, capacity] = row.slice(1, 5);
  const totalBytes = toBytes(Number(blocks));
  const usedBytes = toBytes(Number(used));
  const freeBytes = toBytes(Number(available));
  const usagePercent = safePercent(Number(String(capacity).replace('%', '')));

  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    throw new Error('Disk output contained invalid totals');
  }

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent
  };
};

const getDiskMetrics = async () => {
  try {
    const { stdout } = await execFileAsync('df', ['-k', '/']);
    return parseDiskOutput(stdout);
  } catch (error) {
    return {
      error: `Disk info unavailable: ${error.message}`
    };
  }
};

const getCpuMetrics = (cpuSnapshot) => {
  const { totals, model, cores } = cpuSnapshot;
  const usage = calculateCpuUsage(lastCpuTimes, cpuSnapshot);

  return {
    model,
    cores,
    idlePercent: usage.idlePercent,
    usagePercent: usage.usagePercent,
    loadAverage: os.loadavg()
  };
};

const collectSnapshot = async () => {
  const cpuSnapshot = buildCpuTotals(os.cpus());
  const cpuMetrics = getCpuMetrics(cpuSnapshot);
  const memoryMetrics = getMemoryMetrics();
  const uptimeMetrics = getUptimeMetrics();
  const diskMetrics = await getDiskMetrics();

  const snapshot = {
    timestamp: new Date().toISOString(),
    cpu: cpuMetrics,
    memory: memoryMetrics,
    disk: diskMetrics,
    uptime: uptimeMetrics
  };

  cachedSnapshot = snapshot;
  lastCpuTimes = cpuSnapshot;
  metricsEvents.emit('update', snapshot);
  return snapshot;
};

const startMetricCollector = () => {
  if (collectorTimer) {
    return;
  }

  void collectSnapshot();
  collectorTimer = setInterval(() => {
    void collectSnapshot();
  }, COLLECTION_INTERVAL_MS);
};

const getCachedSnapshot = () => {
  if (!cachedSnapshot) {
    return {
      timestamp: new Date().toISOString(),
      cpu: getCpuMetrics(buildCpuTotals(os.cpus())),
      memory: getMemoryMetrics(),
      disk: { error: 'Disk info unavailable: gathering not yet complete' },
      uptime: getUptimeMetrics()
    };
  }

  return cachedSnapshot;
};

export { METRIC_TYPES, startMetricCollector, getCachedSnapshot, metricsEvents };
