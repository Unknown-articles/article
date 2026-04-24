import os from 'os';
import { execFile } from 'child_process';

let cpuState = null;
let memState = null;
let diskState = null;
let uptimeState = null;
let prevCpuInfo = null;

function computeCpuTotals() {
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

function gatherCpu() {
  const current = computeCpuTotals();
  const cpus = os.cpus();
  const timestamp = new Date().toISOString();

  let idlePercent = 0;
  let usagePercent = 0;

  if (prevCpuInfo !== null) {
    const deltaIdle = current.idle - prevCpuInfo.idle;
    const deltaTotal = current.total - prevCpuInfo.total;
    idlePercent = deltaTotal === 0 ? 0 : (deltaIdle / deltaTotal) * 100;
    usagePercent = 100 - idlePercent;
  }

  prevCpuInfo = current;

  cpuState = {
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

function gatherMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const timestamp = new Date().toISOString();

  memState = {
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

function gatherDisk() {
  const target = process.platform === 'win32' ? null : '/';

  if (process.platform === 'win32') {
    execFile('wmic', ['logicaldisk', 'where', 'DeviceID="C:"', 'get', 'Size,FreeSpace', '/format:csv'], (err, stdout) => {
      if (err) {
        diskState = { type: 'disk', timestamp: new Date().toISOString(), data: { error: err.message } };
        return;
      }
      try {
        const lines = stdout.trim().split(/\r?\n/).filter(l => l.trim() && !l.startsWith('Node'));
        if (!lines.length) throw new Error('no output');
        const parts = lines[0].split(',');
        const freeBytes = parseInt(parts[1], 10);
        const totalBytes = parseInt(parts[2], 10);
        const usedBytes = totalBytes - freeBytes;
        diskState = {
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
        diskState = { type: 'disk', timestamp: new Date().toISOString(), data: { error: e.message } };
      }
    });
    return;
  }

  execFile('df', ['-k', target], (err, stdout) => {
    if (err) {
      diskState = { type: 'disk', timestamp: new Date().toISOString(), data: { error: err.message } };
      return;
    }
    try {
      const lines = stdout.trim().split('\n');
      const parsed = parseDfLine(lines[1]);
      if (!parsed) throw new Error('unexpected df output');
      const totalBytes = parsed.blocks * 1024;
      const usedBytes = parsed.used * 1024;
      const freeBytes = parsed.available * 1024;
      diskState = {
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
      diskState = { type: 'disk', timestamp: new Date().toISOString(), data: { error: e.message } };
    }
  });
}

function uptimeToString(seconds) {
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

function gatherUptime() {
  const uptimeSeconds = os.uptime();
  uptimeState = {
    type: 'uptime',
    timestamp: new Date().toISOString(),
    data: {
      uptimeSeconds,
      formatted: uptimeToString(uptimeSeconds),
      processUptimeSeconds: process.uptime(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
    },
  };
}

const updateCallbacks = [];

export function addUpdateListener(fn) {
  updateCallbacks.push(fn);
}

function collectAll() {
  gatherCpu();
  gatherMemory();
  gatherDisk();
  gatherUptime();
  for (const fn of updateCallbacks) fn();
}

export function initCollection(intervalMs = 1000) {
  prevCpuInfo = computeCpuTotals();
  collectAll();
  setInterval(collectAll, intervalMs);
}

export function getCpuState() {
  return cpuState;
}

export function getMemState() {
  return memState;
}

export function getDiskState() {
  return diskState;
}

export function getUptimeState() {
  return uptimeState;
}

export function getSystemState() {
  return {
    timestamp: new Date().toISOString(),
    cpu: cpuState?.data ?? null,
    memory: memState?.data ?? null,
    disk: diskState?.data ?? null,
    uptime: uptimeState?.data ?? null,
  };
}
