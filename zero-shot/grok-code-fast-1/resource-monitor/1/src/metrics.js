import os from 'os';

let lastCpuInfo = os.cpus();

function getCpuMetrics() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i];
    const prev = lastCpuInfo[i];
    const idleDiff = cpu.times.idle - prev.times.idle;
    const totalDiff = (cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq) - (prev.times.user + prev.times.nice + prev.times.sys + prev.times.idle + prev.times.irq);
    idle += idleDiff;
    total += totalDiff;
  }
  const idlePercent = 100 * idle / total;
  const usagePercent = 100 - idlePercent;
  lastCpuInfo = cpus;
  return {
    model: cpus[0].model.trim(),
    cores: cpus.length,
    idlePercent: Math.round(idlePercent * 100) / 100,
    usagePercent: Math.round(usagePercent * 100) / 100,
    loadAverage: os.loadavg()
  };
}

function getMemoryMetrics() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usagePercent = (used / total) * 100;
  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    usagePercent: Math.round(usagePercent * 100) / 100,
    totalMB: Math.round(total / 1024 / 1024),
    freeMB: Math.round(free / 1024 / 1024),
    usedMB: Math.round(used / 1024 / 1024)
  };
}

function getDiskMetrics() {
  return { error: "Disk usage not available with built-in Node.js modules" };
}

function getUptimeMetrics() {
  const uptime = os.uptime();
  const processUptime = process.uptime();
  const formatted = formatUptime(uptime);
  return {
    uptimeSeconds: uptime,
    formatted,
    processUptimeSeconds: processUptime,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

export { getCpuMetrics, getMemoryMetrics, getDiskMetrics, getUptimeMetrics };