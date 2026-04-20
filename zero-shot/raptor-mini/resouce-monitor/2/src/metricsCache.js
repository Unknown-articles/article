import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
export const METRIC_TYPES = ['cpu', 'memory', 'disk', 'uptime'];

let lastCpuTimes = null;
let cachedMetrics = createEmptyMetrics();

function createEmptyMetrics() {
  return {
    timestamp: new Date().toISOString(),
    cpu: {
      model: os.cpus()[0]?.model || 'unknown',
      cores: os.cpus().length,
      idlePercent: 0,
      usagePercent: 0,
      loadAverage: [...os.loadavg()]
    },
    memory: normalizeMemory(),
    disk: { error: 'Disk information unavailable' },
    uptime: createUptimeMetric()
  };
}

function normalizeMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : 0;
  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent,
    totalMB: Number((totalBytes / 1024 / 1024).toFixed(2)),
    freeMB: Number((freeBytes / 1024 / 1024).toFixed(2)),
    usedMB: Number((usedBytes / 1024 / 1024).toFixed(2))
  };
}

function createUptimeMetric() {
  const uptimeSeconds = Math.max(0, Math.floor(os.uptime()));
  const processUptimeSeconds = Math.max(0, Math.floor(process.uptime()));
  return {
    uptimeSeconds,
    formatted: formatSeconds(uptimeSeconds),
    processUptimeSeconds,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

function formatSeconds(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

function computeCpuMetric() {
  const cpus = os.cpus();
  const model = cpus[0]?.model || 'unknown';
  const cores = cpus.length;
  const currentTimes = cpus.map((cpu) => ({
    user: cpu.times.user,
    nice: cpu.times.nice,
    sys: cpu.times.sys,
    idle: cpu.times.idle,
    irq: cpu.times.irq
  }));

  let idlePercent = 0;
  let usagePercent = 0;
  if (lastCpuTimes) {
    let totalDelta = 0;
    let idleDelta = 0;
    for (let i = 0; i < currentTimes.length; i += 1) {
      const prev = lastCpuTimes[i];
      const curr = currentTimes[i];
      const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
      const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;
      const totalDiff = currTotal - prevTotal;
      const idleDiff = curr.idle - prev.idle;
      if (totalDiff > 0) {
        totalDelta += totalDiff;
        idleDelta += idleDiff;
      }
    }
    if (totalDelta > 0) {
      idlePercent = Number(((idleDelta / totalDelta) * 100).toFixed(2));
      usagePercent = Number((100 - idlePercent).toFixed(2));
    }
  }
  lastCpuTimes = currentTimes;

  return {
    model,
    cores,
    idlePercent,
    usagePercent,
    loadAverage: [...os.loadavg()]
  };
}

async function readDiskInfo() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-WmiObject Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID,FreeSpace,Size | ConvertTo-Json"'
      );
      const parsed = JSON.parse(stdout);
      const entry = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!entry || !entry.FreeSpace || !entry.Size) {
        throw new Error('disk data not found');
      }
      const totalBytes = Number(entry.Size);
      const freeBytes = Number(entry.FreeSpace);
      return buildDiskMetric(totalBytes, freeBytes);
    }

    const { stdout } = await execAsync('df -k --output=size,avail -x tmpfs -x devtmpfs /');
    const lines = stdout.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error('unexpected disk command output');
    }
    const parts = lines[1].trim().split(/\s+/);
    if (parts.length < 2) {
      throw new Error('could not parse disk output');
    }
    const totalBytes = Number(parts[0]) * 1024;
    const freeBytes = Number(parts[1]) * 1024;
    return buildDiskMetric(totalBytes, freeBytes);
  } catch (error) {
    return { error: `Disk information unavailable: ${error.message}` };
  }
}

function buildDiskMetric(totalBytes, freeBytes) {
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : 0;
  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent
  };
}

export async function refreshMetrics() {
  const timestamp = new Date().toISOString();
  const cpu = computeCpuMetric();
  const memory = normalizeMemory();
  const disk = await readDiskInfo();
  const uptime = createUptimeMetric();
  cachedMetrics = { timestamp, cpu, memory, disk, uptime };
  return cachedMetrics;
}

export function getMetrics() {
  return JSON.parse(JSON.stringify(cachedMetrics));
}

export function getMetric(type) {
  if (!METRIC_TYPES.includes(type)) {
    return null;
  }
  return JSON.parse(JSON.stringify(cachedMetrics[type]));
}
