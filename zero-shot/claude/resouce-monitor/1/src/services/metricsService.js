import os from 'os';
import { readdir, stat } from 'fs/promises';
import { METRICS_INTERVAL_MS } from '../config.js';

let cachedMetrics = null;
const subscribers = new Set();

function getCpuUsage() {
  const cpus = os.cpus();
  const totals = cpus.reduce(
    (acc, cpu) => {
      const times = cpu.times;
      acc.idle += times.idle;
      acc.total += times.user + times.nice + times.sys + times.idle + times.irq;
      return acc;
    },
    { idle: 0, total: 0 }
  );

  return {
    model: cpus[0]?.model ?? 'Unknown',
    cores: cpus.length,
    idlePercent: totals.total === 0 ? 0 : (totals.idle / totals.total) * 100,
    usagePercent: totals.total === 0 ? 0 : ((totals.total - totals.idle) / totals.total) * 100,
    loadAverage: os.loadavg(),
  };
}

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    usagePercent: (used / total) * 100,
    totalMB: (total / 1024 / 1024).toFixed(2),
    freeMB: (free / 1024 / 1024).toFixed(2),
    usedMB: (used / 1024 / 1024).toFixed(2),
  };
}

async function getDiskUsage() {
  // Use os.homedir() as a safe cross-platform reference point.
  // On Linux/macOS we can read /proc/statvfs; on Windows we fall back gracefully.
  try {
    // Node 18.8+ exposes statfs; use dynamic import so it degrades on older runtimes.
    const { statfs } = await import('fs/promises');
    const info = await statfs('/');
    const total = info.blocks * info.bsize;
    const free = info.bfree * info.bsize;
    const used = total - free;

    return {
      path: '/',
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      usagePercent: total === 0 ? 0 : (used / total) * 100,
      totalGB: (total / 1024 / 1024 / 1024).toFixed(2),
      freeGB: (free / 1024 / 1024 / 1024).toFixed(2),
      usedGB: (used / 1024 / 1024 / 1024).toFixed(2),
    };
  } catch {
    return { error: 'Disk stats unavailable on this platform' };
  }
}

function getUptime() {
  const uptimeSeconds = os.uptime();
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  return {
    uptimeSeconds,
    formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
    processUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
  };
}

async function collectMetrics() {
  const [disk] = await Promise.all([getDiskUsage()]);

  cachedMetrics = {
    timestamp: new Date().toISOString(),
    cpu: getCpuUsage(),
    memory: getMemoryUsage(),
    disk,
    uptime: getUptime(),
  };

  notifySubscribers();
}

function notifySubscribers() {
  for (const callback of subscribers) {
    try {
      callback(cachedMetrics);
    } catch {
      // Subscriber threw — remove it to avoid future errors.
      subscribers.delete(callback);
    }
  }
}

export function getLatestMetrics() {
  return cachedMetrics;
}

export function getMetricByType(type) {
  if (!cachedMetrics) return null;
  if (type === 'all') return cachedMetrics;
  return cachedMetrics[type] ?? null;
}

export function subscribe(callback) {
  subscribers.add(callback);
}

export function unsubscribe(callback) {
  subscribers.delete(callback);
}

export function startCollection() {
  collectMetrics(); // Collect immediately on start.
  return setInterval(collectMetrics, METRICS_INTERVAL_MS);
}
