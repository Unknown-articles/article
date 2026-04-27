import os from 'os';
import { execSync } from 'child_process';

const VALID_TYPES = ['cpu', 'memory', 'disk', 'uptime'];

function collectCpu() {
  const cpus = os.cpus();
  const model = cpus[0]?.model ?? 'unknown';
  const cores = cpus.length;

  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  const idlePercent = (totalIdle / totalTick) * 100;
  const usagePercent = 100 - idlePercent;
  const loadAverage = os.loadavg();

  return { model, cores, idlePercent, usagePercent, loadAverage };
}

function collectMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = (usedBytes / totalBytes) * 100;
  const MB = 1024 * 1024;
  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent,
    totalMB: totalBytes / MB,
    freeMB: freeBytes / MB,
    usedMB: usedBytes / MB,
  };
}

function collectDisk() {
  try {
    let output;
    if (process.platform === 'win32') {
      output = execSync(
        'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object -Property Used,Free | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 5000 }
      );
      const drives = JSON.parse(output);
      const arr = Array.isArray(drives) ? drives : [drives];
      let totalBytes = 0, freeBytes = 0;
      for (const d of arr) {
        totalBytes += (d.Used ?? 0) + (d.Free ?? 0);
        freeBytes += d.Free ?? 0;
      }
      const usedBytes = totalBytes - freeBytes;
      const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
      return { totalBytes, freeBytes, usedBytes, usagePercent };
    } else {
      output = execSync("df -k / | tail -1", { encoding: 'utf8', timeout: 3000 });
      const parts = output.trim().split(/\s+/);
      const totalBytes = parseInt(parts[1]) * 1024;
      const usedBytes = parseInt(parts[2]) * 1024;
      const freeBytes = parseInt(parts[3]) * 1024;
      const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
      return { totalBytes, freeBytes, usedBytes, usagePercent };
    }
  } catch (err) {
    return { error: `disk info unavailable: ${err.message}` };
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function collectUptime() {
  const uptimeSeconds = os.uptime();
  return {
    uptimeSeconds,
    formatted: formatUptime(uptimeSeconds),
    processUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
  };
}

export function collectAll() {
  return {
    timestamp: new Date().toISOString(),
    cpu: collectCpu(),
    memory: collectMemory(),
    disk: collectDisk(),
    uptime: collectUptime(),
  };
}

export { VALID_TYPES };
