import os from 'os';
import { execSync } from 'child_process';

let prevCpuTimes = null;

function sumCpuTimes(cpus) {
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    for (const [type, time] of Object.entries(cpu.times)) {
      total += time;
      if (type === 'idle') idle += time;
    }
  }
  return { idle, total };
}

export function collectCpu() {
  const cpus = os.cpus();
  const current = sumCpuTimes(cpus);

  let idlePercent = 0;
  let usagePercent = 0;

  if (prevCpuTimes) {
    const idleDelta = current.idle - prevCpuTimes.idle;
    const totalDelta = current.total - prevCpuTimes.total;
    if (totalDelta > 0) {
      idlePercent = (idleDelta / totalDelta) * 100;
      usagePercent = 100 - idlePercent;
    }
  }

  prevCpuTimes = current;

  return {
    model: cpus[0]?.model ?? 'Unknown',
    cores: cpus.length,
    idlePercent: Math.round(idlePercent * 100) / 100,
    usagePercent: Math.round(usagePercent * 100) / 100,
    loadAverage: os.loadavg(),
  };
}

export function collectMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const toMB = (b) => Math.round((b / 1024 / 1024) * 100) / 100;

  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    usagePercent: Math.round((used / total) * 10000) / 100,
    totalMB: toMB(total),
    freeMB: toMB(free),
    usedMB: toMB(used),
  };
}

export function collectDisk() {
  try {
    if (process.platform === 'win32') {
      const raw = execSync(
        'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object { [string]$_.Free + \' \' + [string]$_.Used }"',
        { timeout: 5000 }
      ).toString().trim();

      let totalBytes = 0, freeBytes = 0;
      for (const line of raw.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 2) {
          const free = parseInt(parts[0]);
          const used = parseInt(parts[1]);
          if (!isNaN(free) && !isNaN(used)) {
            freeBytes += free;
            totalBytes += free + used;
          }
        }
      }

      const usedBytes = totalBytes - freeBytes;
      return {
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 10000) / 100 : 0,
      };
    } else {
      const raw = execSync('df -k /', { timeout: 5000 }).toString();
      const parts = raw.trim().split('\n')[1].trim().split(/\s+/);
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
  } catch (err) {
    return { error: `Cannot read disk metrics: ${err.message}` };
  }
}

export function collectUptime() {
  const uptimeSeconds = Math.floor(os.uptime());
  const d = Math.floor(uptimeSeconds / 86400);
  const h = Math.floor((uptimeSeconds % 86400) / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = uptimeSeconds % 60;

  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return {
    uptimeSeconds,
    formatted: parts.join(' '),
    processUptimeSeconds: Math.round(process.uptime() * 100) / 100,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
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
