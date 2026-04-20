import os from "node:os";
import { EventEmitter } from "node:events";
import { METRICS_INTERVAL_MS, METRIC_TYPES } from "../config.js";
import { formatBytes, getDiskUsage } from "./diskService.js";

function readCpuTimes() {
  return os.cpus().map((cpu) => ({ ...cpu.times }));
}

function calculateCpuUsage(previous = [], current = []) {
  if (!previous.length || !current.length) {
    return null;
  }

  let idleDiff = 0;
  let totalDiff = 0;

  current.forEach((times, index) => {
    const earlier = previous[index];
    if (!earlier) {
      return;
    }

    const prevTotal = Object.values(earlier).reduce((sum, value) => sum + value, 0);
    const nextTotal = Object.values(times).reduce((sum, value) => sum + value, 0);
    idleDiff += times.idle - earlier.idle;
    totalDiff += nextTotal - prevTotal;
  });

  if (totalDiff <= 0) {
    return 0;
  }

  return Number((100 - (idleDiff / totalDiff) * 100).toFixed(2));
}

class MetricsService extends EventEmitter {
  constructor() {
    super();
    this.intervalId = null;
    this.previousCpuTimes = readCpuTimes();
    this.snapshot = this.buildInitialSnapshot();
  }

  buildInitialSnapshot() {
    return {
      timestamp: new Date().toISOString(),
      cpu: {
        usagePercent: null,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model ?? "unknown",
        loadAverage: os.loadavg()
      },
      memory: this.readMemoryMetrics(),
      disk: {
        path: process.platform === "win32" ? os.homedir().slice(0, 2) : "/",
        total: null,
        used: null,
        free: null,
        usagePercent: null
      },
      uptime: this.readUptimeMetrics()
    };
  }

  readMemoryMetrics() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total,
      used,
      free,
      usagePercent: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0,
      totalFormatted: formatBytes(total),
      usedFormatted: formatBytes(used),
      freeFormatted: formatBytes(free)
    };
  }

  readUptimeMetrics() {
    return {
      seconds: os.uptime()
    };
  }

  async collectMetrics() {
    const currentCpuTimes = readCpuTimes();
    const disk = await getDiskUsage();

    this.snapshot = {
      timestamp: new Date().toISOString(),
      cpu: {
        usagePercent: calculateCpuUsage(this.previousCpuTimes, currentCpuTimes),
        cores: os.cpus().length,
        model: os.cpus()[0]?.model ?? "unknown",
        loadAverage: os.loadavg()
      },
      memory: this.readMemoryMetrics(),
      disk: {
        ...disk,
        totalFormatted: formatBytes(disk.total),
        usedFormatted: formatBytes(disk.used),
        freeFormatted: formatBytes(disk.free)
      },
      uptime: this.readUptimeMetrics()
    };

    this.previousCpuTimes = currentCpuTimes;
    this.emit("metrics", this.snapshot);
    return this.snapshot;
  }

  start() {
    if (this.intervalId) {
      return;
    }

    this.collectMetrics().catch((error) => {
      this.emit("error", error);
    });

    this.intervalId = setInterval(() => {
      this.collectMetrics().catch((error) => {
        this.emit("error", error);
      });
    }, METRICS_INTERVAL_MS);
  }

  stop() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  getSnapshot() {
    return this.snapshot;
  }

  getMetric(type) {
    if (!METRIC_TYPES.includes(type)) {
      return null;
    }

    return {
      timestamp: this.snapshot.timestamp,
      [type]: this.snapshot[type]
    };
  }
}

export const metricsService = new MetricsService();
