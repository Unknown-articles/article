import os from 'os';
import { EventEmitter } from 'events';

export const metricsEmitter = new EventEmitter();

let cachedMetrics = {
  timestamp: new Date().toISOString(),
  cpu: {},
  memory: {},
  disk: {},
  uptime: {}
};

let previousCpu = getCpuRaw();

function getCpuRaw() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return { totalTick: 0, totalIdle: 0, model: 'unknown', cores: 0 };
  let totalTick = 0;
  let totalIdle = 0;
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  return { totalTick, totalIdle, model: cpus[0].model, cores: cpus.length };
}

function getCpuMetrics() {
  const currentCpu = getCpuRaw();
  const idleDiff = currentCpu.totalIdle - previousCpu.totalIdle;
  const tickDiff = currentCpu.totalTick - previousCpu.totalTick;

  let idlePercent = 100;
  if (tickDiff > 0) {
    idlePercent = (idleDiff / tickDiff) * 100;
  }
  const usagePercent = 100 - idlePercent;

  previousCpu = currentCpu;

  return {
    model: currentCpu.model,
    cores: currentCpu.cores,
    idlePercent: Number(idlePercent.toFixed(2)),
    usagePercent: Number(usagePercent.toFixed(2)),
    loadAverage: os.loadavg()
  };
}

function getMemoryMetrics() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  
  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: Number(usagePercent.toFixed(2)),
    totalMB: Number((totalBytes / 1024 / 1024).toFixed(2)),
    freeMB: Number((freeBytes / 1024 / 1024).toFixed(2)),
    usedMB: Number((usedBytes / 1024 / 1024).toFixed(2))
  };
}

function getDiskMetrics() {
  return { error: "Disk metrics not available via node os module" };
}

function getUptimeMetrics() {
  const uptimeSeconds = os.uptime();
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  const formatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  
  return {
    uptimeSeconds,
    formatted,
    processUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

export function collectMetrics() {
  cachedMetrics = {
    timestamp: new Date().toISOString(),
    cpu: getCpuMetrics(),
    memory: getMemoryMetrics(),
    disk: getDiskMetrics(),
    uptime: getUptimeMetrics()
  };
  metricsEmitter.emit('metrics', cachedMetrics);
  return cachedMetrics;
}

export function getCachedMetrics() {
  return cachedMetrics;
}

// Start collection loop
setInterval(collectMetrics, 1000);
// Initial collection
collectMetrics();
