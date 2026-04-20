import os from 'os';
import fs from 'fs';
import { EventEmitter } from 'events';

export const metricsEmitter = new EventEmitter();

let cachedSnapshot = null;
let lastCpuTimes = null;

function calculateCpuMetrics() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return null;

  const model = cpus[0].model;
  const cores = cpus.length;
  
  let totalUser = 0, totalSys = 0, totalIdle = 0, totalIrq = 0;
  for (const cpu of cpus) {
    totalUser += cpu.times.user;
    totalSys += cpu.times.sys;
    totalIdle += cpu.times.idle;
    totalIrq += cpu.times.irq;
  }
  
  const currentTotal = totalUser + totalSys + totalIdle + totalIrq;
  const currentIdle = totalIdle;
  
  let idlePercent = 0;
  let usagePercent = 0;

  if (lastCpuTimes) {
    const deltaTotal = currentTotal - lastCpuTimes.total;
    const deltaIdle = currentIdle - lastCpuTimes.idle;
    
    if (deltaTotal > 0) {
      idlePercent = (deltaIdle / deltaTotal) * 100;
      usagePercent = 100 - idlePercent;
    }
  }

  lastCpuTimes = { total: currentTotal, idle: currentIdle };
  
  return {
    model,
    cores,
    idlePercent: Math.round(idlePercent * 100) / 100,
    usagePercent: Math.round(usagePercent * 100) / 100,
    loadAverage: os.loadavg()
  };
}

function getMemoryMetrics() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  
  const mb = 1024 * 1024;
  
  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
    totalMB: totalBytes / mb,
    freeMB: freeBytes / mb,
    usedMB: usedBytes / mb
  };
}

function getDiskMetrics() {
  try {
    const stats = fs.statfsSync(process.cwd());
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    
    return {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0
    };
  } catch (err) {
    return { error: 'Disk metrics not available or cannot be read: ' + err.message };
  }
}

function getUptimeMetrics() {
  const uptimeSeconds = os.uptime();
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  let formatted = '';
  if (days > 0) formatted += `${days}d `;
  if (hours > 0) formatted += `${hours}h `;
  if (minutes > 0) formatted += `${minutes}m `;
  formatted += `${seconds}s`;

  return {
    uptimeSeconds,
    formatted: formatted.trim(),
    processUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

export function collectMetrics() {
  const now = new Date();
  cachedSnapshot = {
    timestamp: now.toISOString(),
    cpu: calculateCpuMetrics() || cachedSnapshot?.cpu,
    memory: getMemoryMetrics(),
    disk: getDiskMetrics(),
    uptime: getUptimeMetrics()
  };
  metricsEmitter.emit('snapshot', cachedSnapshot);
}

export function startMetricsCollection(intervalMs = 1000) {
  // initial collection
  collectMetrics();
  setInterval(collectMetrics, intervalMs);
}

export function getCachedSnapshot() {
  return cachedSnapshot;
}
