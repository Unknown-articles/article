import { collectCpu } from './collectors/cpu.js';
import { collectMemory } from './collectors/memory.js';
import { collectDisk } from './collectors/disk.js';
import { collectUptime } from './collectors/uptime.js';
import { COLLECT_INTERVAL_MS } from './config.js';

let cache = null;
let broadcastCallback = null;
let intervalId = null;

function collect() {
  cache = {
    timestamp: new Date().toISOString(),
    cpu: collectCpu(),
    memory: collectMemory(),
    disk: collectDisk(),
    uptime: collectUptime(),
  };
  if (broadcastCallback) broadcastCallback(cache);
}

export function startCollection(onBroadcast) {
  broadcastCallback = onBroadcast;
  collect();
  intervalId = setInterval(collect, COLLECT_INTERVAL_MS);
}

export function stopCollection() {
  if (intervalId) clearInterval(intervalId);
}

export function getCache() {
  return cache;
}
