import { collectMetrics } from './collector.js';

const INTERVAL_MS = 1000;

let cached = null;
let intervalId = null;
const listeners = new Set();

function refresh() {
  cached = collectMetrics();
  for (const fn of listeners) {
    try { fn(cached); } catch { /* ignore listener errors */ }
  }
}

export function startCollection() {
  if (intervalId !== null) return;
  refresh();
  intervalId = setInterval(refresh, INTERVAL_MS);
}

export function stopCollection() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function getSnapshot() {
  return cached;
}

export function onUpdate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
