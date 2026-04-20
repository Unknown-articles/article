import os from 'os';
import { execFile } from 'child_process';

let cpuSnapshot = null;
let memorySnapshot = null;
let diskSnapshot = null;
let uptimeSnapshot = null;
let prevCpuTotals = null;

function getCpuTotals() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const [type, val] of Object.entries(cpu.times)) {
      total += val;
      if (type === 'idle') idle += val;
    }
  }
  return { idle, total };
}

function collectCpu() {
  const current = getCpuTotals();
  const cpus = os.cpus();
  const timestamp = new Date().toISOString();

  let idlePercent = 0;
  let usagePercent = 0;

  if (prevCpuTotals !== null) {
    const deltaIdle = current.idle - prevCpuTotals.idle;
    const deltaTotal = current.total - prevCpuTotals.total;
    idlePercent = deltaTotal === 0 ? 0 : (deltaIdle / deltaTotal) * 100;
    usagePercent = 100 - idlePercent;
  }

  prevCpuTotals = current;

  cpuSnapshot = {
    type: 'cpu',
    timestamp,
    data: {
      model: cpus[0].model,
      cores: cpus.length,
      idlePercent: Math.round(idlePercent * 100) / 100,
      usagePercent: Math.round(usagePercent * 100) / 100,
      loadAverage: os.loadavg(),
    },
  };
}

function collectMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const timestamp = new Date().toISOString();

  memorySnapshot = {
    type: 'memory',
    timestamp,
    data: {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent: Math.round((usedBytes / totalBytes) * 10000) / 100,
      totalMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
      freeMB: Math.round((freeBytes / 1024 / 1024) * 100) / 100,
      usedMB: Math.round((usedBytes / 1024 / 1024) * 100) / 100,
    },
  };
}

function parseDfLine(line) {
  // df -k output columns: Filesystem 1K-blocks Used Available Use% Mounted
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) return null;
  const blocks = parseInt(parts[1], 10);
  const used = parseInt(parts[2], 10);
  const available = parseInt(parts[3], 10);
  if (isNaN(blocks) || isNaN(used) || isNaN(available)) return null;
  return { blocks, used, available };
}

function collectDisk() {
  const target = process.platform === 'win32' ? null : '/';

  if (process.platform === 'win32') {
    // Windows: use wmic to get disk info for the system drive
    execFile('wmic', ['logicaldisk', 'where', 'DeviceID="C:"', 'get', 'Size,FreeSpace', '/format:csv'], (err, stdout) => {
      if (err) {
        diskSnapshot = { type: 'disk', timestamp: new Date().toISOString(), data: { error: err.message } };
        return;
      }
      try {
        // CSV output: Node,FreeSpace,Size
        const lines = stdout.trim().split(/\r?\n/).filter(l => l.trim() && !l.startsWith('Node'));
        if (!lines.length) throw new Error('no output');
        const parts = lines[0].split(',');
        const freeBytes = parseInt(parts[1], 10);
        const totalBytes = parseInt(parts[2], 10);
        const usedBytes = totalBytes - freeBytes;
        diskSnapshot = {
          type: 'disk',
          timestamp: new Date().toISOString(),
          data: {
            totalBytes,
            freeBytes,
            usedBytes,
            usagePercent: Math.round((usedBytes / totalBytes) * 10000) / 100,
          },
        };
      } catch (e) {
        diskSnapshot = { type: 'disk', timestamp: new Date().toISOString(), data: { error: e.message } };
      }
    });
    return;
  }

  execFile('df', ['-k', target], (err, stdout) => {
    if (err) {
      diskSnapshot = { type: 'disk', timestamp: new Date().toISOString(), data: { error: err.message } };
      return;
    }
    try {
      const lines = stdout.trim().split('\n');
      // Skip header line
      const parsed = parseDfLine(lines[1]);
      if (!parsed) throw new Error('unexpected df output');
      const totalBytes = parsed.blocks * 1024;
      const usedBytes = parsed.used * 1024;
      const freeBytes = parsed.available * 1024;
      diskSnapshot = {
        type: 'disk',
        timestamp: new Date().toISOString(),
        data: {
          totalBytes,
          freeBytes,
          usedBytes,
          usagePercent: Math.round((usedBytes / totalBytes) * 10000) / 100,
        },
      };
    } catch (e) {
      diskSnapshot = { type: 'disk', timestamp: new Date().toISOString(), data: { error: e.message } };
    }
  });
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function collectUptime() {
  const uptimeSeconds = os.uptime();
  uptimeSnapshot = {
    type: 'uptime',
    timestamp: new Date().toISOString(),
    data: {
      uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
      processUptimeSeconds: process.uptime(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
    },
  };
}

const tickListeners = [];

export function onTick(fn) {
  tickListeners.push(fn);
}

function tick() {
  collectCpu();
  collectMemory();
  collectDisk();
  collectUptime();
  for (const fn of tickListeners) fn();
}

export function startMetricsCollection(intervalMs = 1000) {
  // Prime prevCpuTotals so first real tick has a delta
  prevCpuTotals = getCpuTotals();
  tick();
  setInterval(tick, intervalMs);
}

export function getCpuSnapshot() {
  return cpuSnapshot;
}

export function getMemorySnapshot() {
  return memorySnapshot;
}

export function getDiskSnapshot() {
  return diskSnapshot;
}

export function getUptimeSnapshot() {
  return uptimeSnapshot;
}

export function getFullSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    cpu: cpuSnapshot?.data ?? null,
    memory: memorySnapshot?.data ?? null,
    disk: diskSnapshot?.data ?? null,
    uptime: uptimeSnapshot?.data ?? null,
  };
}
