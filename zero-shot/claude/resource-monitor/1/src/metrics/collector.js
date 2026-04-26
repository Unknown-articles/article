import os from 'os';
import { execSync } from 'child_process';

function getCpu() {
  const cpus = os.cpus();
  const model = cpus[0]?.model ?? 'unknown';
  const cores = cpus.length;

  const totals = cpus.reduce(
    (acc, cpu) => {
      const times = cpu.times;
      const total = Object.values(times).reduce((s, v) => s + v, 0);
      acc.idle += times.idle;
      acc.total += total;
      return acc;
    },
    { idle: 0, total: 0 }
  );

  const idlePercent = totals.total > 0 ? (totals.idle / totals.total) * 100 : 0;
  const usagePercent = 100 - idlePercent;
  const loadAverage = os.loadavg();

  return {
    model,
    cores,
    idlePercent: Math.round(idlePercent * 100) / 100,
    usagePercent: Math.round(usagePercent * 100) / 100,
    loadAverage,
  };
}

function getMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = (usedBytes / totalBytes) * 100;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: Math.round(usagePercent * 100) / 100,
    totalMB: Math.round(totalBytes / 1024 / 1024),
    freeMB: Math.round(freeBytes / 1024 / 1024),
    usedMB: Math.round(usedBytes / 1024 / 1024),
  };
}

function getDisk() {
  try {
    let output;
    if (process.platform === 'win32') {
      output = execSync('wmic logicaldisk get size,freespace,caption', { timeout: 3000 })
        .toString()
        .trim();
      const lines = output.split('\n').slice(1).filter(Boolean);
      let totalBytes = 0;
      let freeBytes = 0;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          freeBytes += parseInt(parts[1]) || 0;
          totalBytes += parseInt(parts[2]) || 0;
        }
      }
      if (totalBytes === 0) return { error: 'no disk data available' };
      const usedBytes = totalBytes - freeBytes;
      return {
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: Math.round((usedBytes / totalBytes) * 10000) / 100,
      };
    } else {
      output = execSync("df -k / | tail -1", { timeout: 3000 }).toString().trim();
      const parts = output.split(/\s+/);
      const totalBytes = parseInt(parts[1]) * 1024;
      const usedBytes = parseInt(parts[2]) * 1024;
      const freeBytes = parseInt(parts[3]) * 1024;
      return {
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: Math.round((usedBytes / totalBytes) * 10000) / 100,
      };
    }
  } catch {
    return { error: 'disk info unavailable' };
  }
}

function getUptime() {
  const uptimeSeconds = os.uptime();
  const processUptimeSeconds = process.uptime();

  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return {
    uptimeSeconds,
    formatted: parts.join(' '),
    processUptimeSeconds: Math.round(processUptimeSeconds * 100) / 100,
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
  };
}

export function collectMetrics() {
  return {
    timestamp: new Date().toISOString(),
    cpu: getCpu(),
    memory: getMemory(),
    disk: getDisk(),
    uptime: getUptime(),
  };
}
