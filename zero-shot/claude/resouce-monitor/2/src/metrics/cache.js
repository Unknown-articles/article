import { collectAll } from './collector.js';

const INTERVAL_MS = 1000;

let snapshot = null;
let timer = null;
const listeners = new Set();

function refresh() {
  snapshot = collectAll();
  for (const fn of listeners) fn(snapshot);
}

export function startCollection() {
  refresh();
  timer = setInterval(refresh, INTERVAL_MS);
}

export function stopCollection() {
  clearInterval(timer);
  timer = null;
}

export function getSnapshot() {
  return snapshot;
}

export function onRefresh(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
