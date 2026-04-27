import os from 'os';
import fs from 'fs';

export function collectMetrics() {
  const timestamp = new Date().toISOString();

  const cpu = collectCPU();
  const memory = collectMemory();
  const disk = collectDisk();
  const uptime = collectUptime();

  return {
    timestamp,
    cpu,
    memory,
    disk,
    uptime
  };
}

function collectCPU() {
  const cpus = os.cpus();
  const model = cpus[0].model;
  const cores = cpus.length;

  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idlePercent = (totalIdle / totalTick) * 100;
  const usagePercent = 100 - idlePercent;

  const loadAverage = os.loadavg();

  return {
    model,
    cores,
    idlePercent: Math.round(idlePercent * 100) / 100,
    usagePercent: Math.round(usagePercent * 100) / 100,
    loadAverage
  };
}

function collectMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = (usedBytes / totalBytes) * 100;

  const totalMB = Math.round(totalBytes / (1024 * 1024));
  const freeMB = Math.round(freeBytes / (1024 * 1024));
  const usedMB = Math.round(usedBytes / (1024 * 1024));

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: Math.round(usagePercent * 100) / 100,
    totalMB,
    freeMB,
    usedMB
  };
}

function collectDisk() {
  try {
    // For simplicity, check the root filesystem
    const stats = fs.statSync('/');
    // This is not accurate for disk usage, but Node.js doesn't have built-in disk usage
    // In real implementation, might need 'diskusage' package, but sticking to built-in
    // Since requirements say "when available", and built-in can't, return error
    return { error: 'Disk usage not available with built-in modules' };
  } catch (err) {
    return { error: 'Unable to read disk information' };
  }
}

function collectUptime() {
  const uptimeSeconds = os.uptime();
  const formatted = formatUptime(uptimeSeconds);
  const processUptimeSeconds = process.uptime();
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

  return {
    uptimeSeconds,
    formatted,
    processUptimeSeconds,
    hostname,
    platform,
    arch
  };
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  let formatted = '';
  if (days > 0) formatted += `${days}d `;
  if (hours > 0) formatted += `${hours}h `;
  if (minutes > 0) formatted += `${minutes}m `;
  formatted += `${secs}s`;

  return formatted.trim();
}