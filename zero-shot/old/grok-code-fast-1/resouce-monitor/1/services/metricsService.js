import os from 'os';

let metrics = {};
let cpuTimes = os.cpus().map(cpu => cpu.times);

function collectMetrics() {
  // CPU usage
  const newCpuTimes = os.cpus().map(cpu => cpu.times);
  const cpuUsage = newCpuTimes.map((newTimes, i) => {
    const oldTimes = cpuTimes[i];
    const totalOld = oldTimes.user + oldTimes.nice + oldTimes.sys + oldTimes.idle + oldTimes.irq;
    const totalNew = newTimes.user + newTimes.nice + newTimes.sys + newTimes.idle + newTimes.irq;
    const idleDiff = newTimes.idle - oldTimes.idle;
    const totalDiff = totalNew - totalOld;
    return totalDiff === 0 ? 0 : ((totalDiff - idleDiff) / totalDiff) * 100;
  });
  cpuTimes = newCpuTimes;
  const avgCpu = cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length;

  // Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = ((totalMem - freeMem) / totalMem) * 100;

  // Uptime
  const uptime = os.uptime();

  metrics = {
    cpu: Math.round(avgCpu * 100) / 100, // round to 2 decimals
    memory: Math.round(memUsage * 100) / 100,
    uptime: uptime
  };
}

export function startMetricsCollection(callback) {
  collectMetrics();
  setInterval(() => {
    collectMetrics();
    if (callback) callback();
  }, 1000);
}

export function getMetrics() {
  return { ...metrics };
}

export function getMetric(type) {
  return metrics[type];
}