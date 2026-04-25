import os from "node:os";
import process from "node:process";
import { execFile as execFileCallback } from "node:child_process";
import { EventEmitter } from "node:events";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const BYTES_PER_MB = 1024 * 1024;

function roundNumber(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function readCpuTimes() {
  return os.cpus().map((cpu) => ({ ...cpu.times }));
}

function calculateCpuMetrics(previousCpuTimes, currentCpuTimes) {
  let idleDelta = 0;
  let totalDelta = 0;

  for (let index = 0; index < currentCpuTimes.length; index += 1) {
    const previous = previousCpuTimes[index];
    const current = currentCpuTimes[index];

    const previousTotal = Object.values(previous).reduce((sum, value) => sum + value, 0);
    const currentTotal = Object.values(current).reduce((sum, value) => sum + value, 0);

    idleDelta += current.idle - previous.idle;
    totalDelta += currentTotal - previousTotal;
  }

  const idlePercent = totalDelta === 0 ? 100 : (idleDelta / totalDelta) * 100;
  const usagePercent = 100 - idlePercent;
  const [firstCpu] = os.cpus();

  return {
    model: firstCpu?.model ?? "unknown",
    cores: currentCpuTimes.length,
    idlePercent: roundNumber(Math.min(Math.max(idlePercent, 0), 100)),
    usagePercent: roundNumber(Math.min(Math.max(usagePercent, 0), 100)),
    loadAverage: os.loadavg().map((value) => roundNumber(value, 3)),
  };
}

function collectMemoryMetrics() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = totalBytes === 0 ? 0 : (usedBytes / totalBytes) * 100;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: roundNumber(Math.min(Math.max(usagePercent, 0), 100)),
    totalMB: roundNumber(totalBytes / BYTES_PER_MB),
    freeMB: roundNumber(freeBytes / BYTES_PER_MB),
    usedMB: roundNumber(usedBytes / BYTES_PER_MB),
  };
}

function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0 || parts.length > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || parts.length > 0) {
    parts.push(`${minutes}m`);
  }

  parts.push(`${seconds}s`);

  return parts.join(" ");
}

function collectUptimeMetrics() {
  const uptimeSeconds = os.uptime();

  return {
    uptimeSeconds,
    formatted: formatUptime(uptimeSeconds),
    processUptimeSeconds: roundNumber(process.uptime(), 3),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

async function collectDiskMetrics() {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFile("wmic", [
        "logicaldisk",
        "where",
        "DeviceID='C:'",
        "get",
        "Size,FreeSpace",
        "/format:value",
      ]);
      const entries = Object.fromEntries(
        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.split("=")),
      );

      const totalBytes = Number(entries.Size);
      const freeBytes = Number(entries.FreeSpace);

      if (Number.isFinite(totalBytes) && Number.isFinite(freeBytes) && totalBytes > 0) {
        const usedBytes = totalBytes - freeBytes;

        return {
          totalBytes,
          freeBytes,
          usedBytes,
          usagePercent: roundNumber((usedBytes / totalBytes) * 100),
        };
      }
    }

    if (process.platform !== "win32") {
      const { stdout } = await execFile("df", ["-k", "/"]);
      const lines = stdout.trim().split(/\r?\n/);
      const values = lines.at(-1)?.trim().split(/\s+/);

      if (values && values.length >= 4) {
        const totalBytes = Number(values[1]) * 1024;
        const usedBytes = Number(values[2]) * 1024;
        const freeBytes = Number(values[3]) * 1024;

        if (Number.isFinite(totalBytes) && totalBytes > 0) {
          return {
            totalBytes,
            freeBytes,
            usedBytes,
            usagePercent: roundNumber((usedBytes / totalBytes) * 100),
          };
        }
      }
    }
  } catch (error) {
    return { error: `Disk metrics unavailable: ${error.message}` };
  }

  return { error: `Disk metrics unavailable on platform: ${process.platform}` };
}

function createEmptySnapshot() {
  return {
    timestamp: new Date(0).toISOString(),
    cpu: {
      model: "unknown",
      cores: 0,
      idlePercent: 100,
      usagePercent: 0,
      loadAverage: [],
    },
    memory: {
      totalBytes: 0,
      freeBytes: 0,
      usedBytes: 0,
      usagePercent: 0,
      totalMB: 0,
      freeMB: 0,
      usedMB: 0,
    },
    disk: { error: "Disk metrics unavailable before initialization." },
    uptime: {
      uptimeSeconds: 0,
      formatted: "0s",
      processUptimeSeconds: 0,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
    },
  };
}

export class MetricsStore extends EventEmitter {
  constructor({ intervalMs = 1000 } = {}) {
    super();
    this.intervalMs = intervalMs;
    this.previousCpuTimes = readCpuTimes();
    this.snapshot = createEmptySnapshot();
    this.timer = null;
    this.refreshInFlight = null;
  }

  async start() {
    await this.refresh();
    this.timer = setInterval(() => {
      this.refresh().catch((error) => {
        console.error("Failed to refresh metrics", error);
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getSnapshot() {
    return this.snapshot;
  }

  async refresh() {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.collectSnapshot().finally(() => {
      this.refreshInFlight = null;
    });

    this.snapshot = await this.refreshInFlight;
    this.emit("snapshot", this.snapshot);
    return this.snapshot;
  }

  async collectSnapshot() {
    const currentCpuTimes = readCpuTimes();
    const [disk, memory] = await Promise.all([collectDiskMetrics(), Promise.resolve(collectMemoryMetrics())]);
    const snapshot = {
      timestamp: new Date().toISOString(),
      cpu: calculateCpuMetrics(this.previousCpuTimes, currentCpuTimes),
      memory,
      disk,
      uptime: collectUptimeMetrics(),
    };

    this.previousCpuTimes = currentCpuTimes;
    return snapshot;
  }
}
