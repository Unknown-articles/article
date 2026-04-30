import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
export const VALID_METRIC_TYPES = ["cpu", "memory", "disk", "uptime"];

function formatBytes(value) {
  return Number(value.toFixed(0));
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

function getCpuSnapshot() {
  const cpus = os.cpus() || [];
  const models = cpus.map((cpu) => cpu.model).filter(Boolean);
  const totalCores = cpus.length;

  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    const { times } = cpu;
    totalIdle += times.idle;
    totalTick += times.user + times.nice + times.sys + times.idle + times.irq;
  });

  const idlePercent = totalTick > 0 ? Number(((totalIdle / totalTick) * 100).toFixed(2)) : 0;
  const usagePercent = Number((100 - idlePercent).toFixed(2));

  return {
    model: models[0] || os.type(),
    cores: totalCores,
    idlePercent,
    usagePercent,
    loadAverage: os.loadavg().slice(0, 3).map((value) => Number(value.toFixed(2)))
  };
}

function getMemorySnapshot() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : 0;

  return {
    totalBytes: formatBytes(totalBytes),
    freeBytes: formatBytes(freeBytes),
    usedBytes: formatBytes(usedBytes),
    usagePercent,
    totalMB: formatBytes(totalBytes / 1024 / 1024),
    freeMB: formatBytes(freeBytes / 1024 / 1024),
    usedMB: formatBytes(usedBytes / 1024 / 1024)
  };
}

function getUptimeSnapshot() {
  return {
    uptimeSeconds: Number(os.uptime().toFixed(0)),
    formatted: formatUptime(os.uptime()),
    processUptimeSeconds: Number(process.uptime().toFixed(0)),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

async function collectDiskSnapshot() {
  const platform = os.platform();

  if (platform === "win32") {
    return { error: "Disk metrics are not available on this platform" };
  }

  try {
    const { stdout } = await execFileAsync("df", ["-k", "/"]);
    const lines = stdout.trim().split(/\r?\n/);

    if (lines.length < 2) {
      return { error: "Unable to parse disk usage" };
    }

    const parts = lines[1].split(/\s+/);
    const totalKb = Number(parts[1]);
    const usedKb = Number(parts[2]);
    const freeKb = Number(parts[3]);
    const usagePercent = Number(parts[4].replace("%", ""));

    if (Number.isNaN(totalKb) || Number.isNaN(usedKb) || Number.isNaN(freeKb) || Number.isNaN(usagePercent)) {
      return { error: "Unable to parse disk usage" };
    }

    return {
      totalBytes: formatBytes(totalKb * 1024),
      freeBytes: formatBytes(freeKb * 1024),
      usedBytes: formatBytes(usedKb * 1024),
      usagePercent: Number(usagePercent.toFixed(2))
    };
  } catch (error) {
    return { error: "Unable to read disk metrics" };
  }
}

async function collectSnapshot() {
  const timestamp = new Date().toISOString();
  const [disk] = await Promise.all([collectDiskSnapshot()]);

  return {
    timestamp,
    cpu: getCpuSnapshot(),
    memory: getMemorySnapshot(),
    disk,
    uptime: getUptimeSnapshot()
  };
}

export class MetricsCache {
  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
    this.latest = null;
    this.ready = this.start();
  }

  async start() {
    await this.refresh();
    this.timer = setInterval(() => this.refresh().catch((error) => {
      console.error("Metric collection error:", error);
    }), this.intervalMs);
  }

  async refresh() {
    this.latest = await collectSnapshot();
  }

  getSnapshot() {
    if (this.latest) {
      return this.latest;
    }

    return {
      timestamp: new Date().toISOString(),
      cpu: getCpuSnapshot(),
      memory: getMemorySnapshot(),
      disk: { error: "Disk metrics are not yet available" },
      uptime: getUptimeSnapshot()
    };
  }
}
