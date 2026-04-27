import os from 'os';

function getCpuMetrics() {
  const cpus = os.cpus();
  const model = cpus[0].model;
  const cores = cpus.length;
  let totalIdle = 0;
  let totalTick = 0;
  cpus.forEach(cpu => {
    const times = cpu.times;
    totalIdle += times.idle;
    totalTick += times.user + times.nice + times.sys + times.idle + times.irq;
  });
  const idlePercent = (totalIdle / totalTick) * 100;
  const usagePercent = 100 - idlePercent;
  const loadAverage = os.loadavg();
  return { model, cores, idlePercent, usagePercent, loadAverage };
}

function getMemoryMetrics() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const usagePercent = (usedBytes / totalBytes) * 100;
  const totalMB = totalBytes / (1024 * 1024);
  const freeMB = freeBytes / (1024 * 1024);
  const usedMB = usedBytes / (1024 * 1024);
  return { totalBytes, freeBytes, usedBytes, usagePercent, totalMB, freeMB, usedMB };
}

function getDiskMetrics() {
  // On Windows, cannot easily get disk usage with built-in modules
  return { error: "Disk usage not available on this platform" };
}

function getUptimeMetrics() {
  const uptimeSeconds = os.uptime();
  const processUptimeSeconds = process.uptime();
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  // formatted
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  let formatted = '';
  if (days > 0) formatted += `${days} day${days > 1 ? 's' : ''}, `;
  if (hours > 0) formatted += `${hours} hour${hours > 1 ? 's' : ''}, `;
  if (minutes > 0) formatted += `${minutes} minute${minutes > 1 ? 's' : ''}, `;
  formatted += `${seconds} second${seconds > 1 ? 's' : ''}`;
  return { uptimeSeconds, formatted, processUptimeSeconds, hostname, platform, arch };
}

export { getCpuMetrics, getMemoryMetrics, getDiskMetrics, getUptimeMetrics };