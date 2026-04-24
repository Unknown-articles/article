import { execSync } from "child_process";
import os from "os";

const SAMPLE_INTERVAL_MS = 1000;
let latestCpuSnapshot = null;
let latestMemorySnapshot = null;
let latestDiskSnapshot = null;
let latestUptimeSnapshot = null;
let latestFullSnapshot = null;
let lastCpuState = os.cpus();
let intervalHandle = null;
const refreshSubscribers = [];

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function roundNumber(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function convertBytesToMB(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

function humanizeDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

function buildCpuOverview(prevCpuInfos, currentCpuInfos) {
  const cores = currentCpuInfos.length;
  let totalDelta = 0;
  let idleDelta = 0;

  for (let i = 0; i < cores; i += 1) {
    const previousTimes = prevCpuInfos[i].times;
    const currentTimes = currentCpuInfos[i].times;
    const previousTotal =
      previousTimes.user +
      previousTimes.nice +
      previousTimes.sys +
      previousTimes.idle +
      previousTimes.irq;
    const currentTotal =
      currentTimes.user +
      currentTimes.nice +
      currentTimes.sys +
      currentTimes.idle +
      currentTimes.irq;

    const delta = currentTotal - previousTotal;
    totalDelta += delta;
    idleDelta += currentTimes.idle - previousTimes.idle;
  }

  const idlePercent = totalDelta > 0 ? roundNumber((idleDelta / totalDelta) * 100, 2) : 0;
  const usagePercent = roundNumber(100 - idlePercent, 2);

  return {
    model: currentCpuInfos[0]?.model ?? "",
    cores,
    idlePercent,
    usagePercent,
    loadAverage: os.loadavg(),
  };
}

function buildMemoryOverview() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = totalBytes > 0 ? roundNumber((usedBytes / totalBytes) * 100, 2) : 0;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent,
    totalMB: convertBytesToMB(totalBytes),
    freeMB: convertBytesToMB(freeBytes),
    usedMB: convertBytesToMB(usedBytes),
  };
}

function parseDiskLine(output) {
  const lines = output.trim().split(/?
/).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Unexpected df output");
  }
  const dataLine = lines[lines.length - 1].trim();
  const tokens = dataLine.split(/\s+/);
  if (tokens.length < 6) {
    throw new Error("Unexpected df row format");
  }
  const totalK = Number(tokens[tokens.length - 5]);
  const usedK = Number(tokens[tokens.length - 4]);
  const availableK = Number(tokens[tokens.length - 3]);
  if (Number.isNaN(totalK) || Number.isNaN(usedK) || Number.isNaN(availableK)) {
    throw new Error("Invalid df data values");
  }
  return {
    totalBytes: totalK * 1024,
    freeBytes: availableK * 1024,
    usedBytes: usedK * 1024,
    usagePercent: roundNumber((usedK / totalK) * 100, 2),
  };
}

function collectDiskInfo() {
  try {
    if (process.platform === "win32") {
      const output = execSync(
        `wmic logicaldisk where DeviceID='C:' get Size,FreeSpace /format:csv`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      );
      const lines = output.trim().split(/?
/).filter(Boolean);
      if (lines.length < 2) {
        throw new Error("No disk data returned");
      }
      const header = lines[0].split(",").map((col) => col.trim());
      const values = lines[1].split(",").map((value) => value.trim());
      const sizeIndex = header.indexOf("Size");
      const freeIndex = header.indexOf("FreeSpace");
      if (sizeIndex === -1 || freeIndex === -1) {
        throw new Error("Unexpected WMIC output header");
      }
      const totalBytes = Number(values[sizeIndex]);
      const freeBytes = Number(values[freeIndex]);
      if (Number.isNaN(totalBytes) || Number.isNaN(freeBytes)) {
        throw new Error("Invalid WMIC values");
      }
      const usedBytes = totalBytes - freeBytes;
      return {
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: roundNumber((usedBytes / totalBytes) * 100, 2),
      };
    }

    const output = execSync("df -kP /", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return parseDiskLine(output);
  } catch (error) {
    return { error: `Disk metrics unavailable: ${error.message}` };
  }
}

function analyzeUptime() {
  const uptimeSeconds = os.uptime();
  const processUptimeSeconds = process.uptime();
  return {
    uptimeSeconds: roundNumber(uptimeSeconds, 2),
    formatted: humanizeDuration(uptimeSeconds),
    processUptimeSeconds: roundNumber(processUptimeSeconds, 2),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

function refreshMetrics() {
  const currentCpuInfos = os.cpus();
  const timestamp = getCurrentTimestamp();

  latestCpuSnapshot = {
    type: "cpu",
    timestamp,
    data: buildCpuOverview(lastCpuState, currentCpuInfos),
  };

  latestMemorySnapshot = {
    type: "memory",
    timestamp,
    data: buildMemoryOverview(),
  };

  latestDiskSnapshot = {
    type: "disk",
    timestamp,
    data: collectDiskInfo(),
  };

  latestUptimeSnapshot = {
    type: "uptime",
    timestamp,
    data: analyzeUptime(),
  };

  latestFullSnapshot = {
    timestamp,
    cpu: latestCpuSnapshot.data,
    memory: latestMemorySnapshot.data,
    disk: latestDiskSnapshot.data,
    uptime: latestUptimeSnapshot.data,
  };

  refreshSubscribers.forEach((listener) => {
    try {
      listener(latestFullSnapshot);
    } catch (error) {
      // Ignore individual subscriber errors.
    }
  });

  lastCpuState = currentCpuInfos;
}

export function registerMetricSubscriber(callback) {
  if (typeof callback === "function") {
    refreshSubscribers.push(callback);
  }
}

export function kickOffMetricRefresh() {
  if (intervalHandle) {
    return;
  }

  refreshMetrics();
  intervalHandle = setInterval(refreshMetrics, SAMPLE_INTERVAL_MS);
}

export function getCpuSnapshot() {
  return latestCpuSnapshot;
}

export function getMemorySnapshot() {
  return latestMemorySnapshot;
}

export function getDiskSnapshot() {
  return latestDiskSnapshot;
}

export function getUptimeSnapshot() {
  return latestUptimeSnapshot;
}

export function getMetricsSnapshot() {
  return latestFullSnapshot;
}
