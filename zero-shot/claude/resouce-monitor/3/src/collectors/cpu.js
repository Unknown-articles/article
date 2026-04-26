import os from 'os';

let prevTimes = null;

function getCpuTimes() {
  const cpus = os.cpus();
  return cpus.reduce(
    (acc, cpu) => {
      for (const [key, val] of Object.entries(cpu.times)) {
        acc[key] = (acc[key] ?? 0) + val;
      }
      return acc;
    },
    {}
  );
}

export function collectCpu() {
  const cpus = os.cpus();
  const current = getCpuTimes();

  let idlePercent = 0;
  let usagePercent = 0;

  if (prevTimes) {
    const idle = current.idle - prevTimes.idle;
    const total = Object.values(current).reduce((a, b) => a + b, 0)
                - Object.values(prevTimes).reduce((a, b) => a + b, 0);
    idlePercent = total > 0 ? (idle / total) * 100 : 100;
    usagePercent = 100 - idlePercent;
  }

  prevTimes = current;

  return {
    model: cpus[0]?.model ?? 'unknown',
    cores: cpus.length,
    idlePercent: parseFloat(idlePercent.toFixed(2)),
    usagePercent: parseFloat(usagePercent.toFixed(2)),
    loadAverage: os.loadavg(),
  };
}
