import { collectAll } from './metrics.js';

const INTERVAL_MS = 1000;

let snapshot = collectAll();
const subscribers = new Set();

function broadcast() {
  snapshot = collectAll();
  for (const cb of subscribers) {
    try { cb(snapshot); } catch (_) { /* client removed mid-loop */ }
  }
}

const intervalId = setInterval(broadcast, INTERVAL_MS);

export function getSnapshot() {
  return snapshot;
}

export function subscribe(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function stopCache() {
  clearInterval(intervalId);
}
