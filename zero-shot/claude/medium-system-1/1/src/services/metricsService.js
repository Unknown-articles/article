import { cpus, totalmem, freemem } from 'os';

// ─── State ────────────────────────────────────────────────────────────────────

let snapshot = {
  cpu:    0,
  memory: { total: 0, used: 0, free: 0, usedPercent: 0 },
  uptime: 0
};

let previousCpus = null;
let intervalId   = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCpuUsage() {
  const current = cpus();

  if (!previousCpus) {
    previousCpus = current;
    return 0;
  }

  let totalDiff = 0;
  let idleDiff  = 0;

  current.forEach((cpu, i) => {
    const prev      = previousCpus[i];
    const currTotal = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const prevTotal = Object.values(prev.times).reduce((a, b) => a + b, 0);
    totalDiff += currTotal - prevTotal;
    idleDiff  += cpu.times.idle - prev.times.idle;
  });

  previousCpus = current;

  return totalDiff === 0 ? 0 : parseFloat(((1 - idleDiff / totalDiff) * 100).toFixed(2));
}

function collect() {
  const total = totalmem();
  const free  = freemem();
  const used  = total - free;

  snapshot = {
    cpu: computeCpuUsage(),
    memory: {
      total,
      used,
      free,
      usedPercent: parseFloat((used / total * 100).toFixed(2))
    },
    uptime: parseFloat(process.uptime().toFixed(2))
  };

  return snapshot;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Starts periodic collection.  Calls onUpdate(snapshot) after each tick.
 * First call establishes the CPU baseline (returns 0); subsequent calls
 * compute delta-based usage across all logical cores.
 */
export function startMetricsCollection(intervalMs = 1000, onUpdate) {
  collect();          // baseline — CPU returns 0
  intervalId = setInterval(() => {
    const s = collect();
    if (onUpdate) onUpdate(s);
  }, intervalMs);
}

export function stopMetricsCollection() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

export function getSnapshot() {
  return { ...snapshot };
}
