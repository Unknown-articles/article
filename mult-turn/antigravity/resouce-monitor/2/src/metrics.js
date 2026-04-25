import os from 'os';
import { statfs } from 'fs/promises';

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  let formatted = [];
  if (d > 0) formatted.push(`${d}d`);
  if (h > 0) formatted.push(`${h}h`);
  if (m > 0) formatted.push(`${m}m`);
  formatted.push(`${s}s`);
  return formatted.join(' ') || '0s';
}

class monitoringEngine {
  constructor() {
    this.cache = {
      cpu: null,
      memory: null,
      disk: null,
      uptime: null
    };
    this.previousCpuTimes = this.getCpuTimes();
    this.timer = null;
    this.onTick = null;
  }

  getCpuTimes() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    }
    return { idle, total };
  }

  start(intervalMs = 1000) {
    if (this.timer) clearInterval(this.timer);
    // Initial population without delay
    this.refresh();
    
    this.timer = setInterval(() => {
      this.refresh();
    }, intervalMs);
  }

  async refresh() {
    const timestamp = new Date().toISOString();
    
    // Process CPU
    const currentCpuTimes = this.getCpuTimes();
    const idleDiff = currentCpuTimes.idle - this.previousCpuTimes.idle;
    const totalDiff = currentCpuTimes.total - this.previousCpuTimes.total;
    
    let usagePercent = 0;
    let idlePercent = 100;
    
    if (totalDiff > 0) {
      const calculatedIdle = (idleDiff / totalDiff) * 100;
      idlePercent = Number(calculatedIdle.toFixed(2));
      usagePercent = Number((100 - calculatedIdle).toFixed(2));
    }
    
    this.previousCpuTimes = currentCpuTimes;
    const cpus = os.cpus();
    
    this.cache.cpu = {
      type: 'cpu',
      timestamp,
      data: {
        model: cpus[0].model,
        cores: cpus.length,
        idlePercent,
        usagePercent,
        loadAverage: os.loadavg()
      }
    };

    // Process Memory
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    
    this.cache.memory = {
      type: 'memory',
      timestamp,
      data: {
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: Number(((usedBytes / totalBytes) * 100).toFixed(2)),
        totalMB: totalBytes / (1024 * 1024),
        freeMB: freeBytes / (1024 * 1024),
        usedMB: usedBytes / (1024 * 1024)
      }
    };

    // Process Disk
    try {
      const driveRoot = os.platform() === 'win32' ? 'C:\\' : '/';
      const stats = await statfs(driveRoot);
      const diskTotalBytes = stats.blocks * stats.bsize;
      const diskFreeBytes = stats.bavail * stats.bsize;
      const diskUsedBytes = diskTotalBytes - diskFreeBytes;
      this.cache.disk = {
        type: 'disk',
        timestamp,
        data: {
          totalBytes: diskTotalBytes,
          freeBytes: diskFreeBytes,
          usedBytes: diskUsedBytes,
          usagePercent: Number(((diskUsedBytes / diskTotalBytes) * 100).toFixed(2))
        }
      };
    } catch (err) {
      this.cache.disk = {
        type: 'disk',
        timestamp,
        data: { error: err.message }
      };
    }

    // Process Uptime
    const uptimeSeconds = os.uptime();
    this.cache.uptime = {
      type: 'uptime',
      timestamp,
      data: {
        uptimeSeconds,
        formatted: formatUptime(uptimeSeconds),
        processUptimeSeconds: process.uptime(),
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch()
      }
    };

    if (this.onTick) {
      this.onTick(this.fetchFullSnapshot());
    }
  }

  fetchSnapshot(type) {
    return this.cache[type];
  }

  fetchFullSnapshot() {
    return {
      timestamp: this.cache.cpu ? this.cache.cpu.timestamp : new Date().toISOString(),
      cpu: this.cache.cpu?.data || null,
      memory: this.cache.memory?.data || null,
      disk: this.cache.disk?.data || null,
      uptime: this.cache.uptime?.data || null
    };
  }
}

export const monitoringEngine = new monitoringEngine();

