import os from 'os';
import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile } from 'fs/promises';
import {cpuCoreUsage, cpuAverage, memUsedPercent, diskUsedPercent, bytesThroughput, floorSeconds, convertDate as _convertDate, WIFI_IFACE_RE, PS_GPU_UTIL, buildPsCommand, NVIDIA_SMI_CMD, DRM_CARD_RE, parseGpuUtilOutput,} from './utils.js';

const execAsync = promisify(exec);

// ─── Cached metrics, updated every second ────────────────────────────────────
let cachedMetrics = {
  cpu: null, memory: null, uptime: null,
  disk: { drives: [], ioUtil: null, layout: [] },
  network: { ethernet: [], wifi: [] },
  gpu: [], processes: [],
};

// ─── Static hardware info (loaded once at startup) ────────────────────────────
let hwCpu = null;
let hwMemory = [];
let hwDiskLayout = [];

// Previous CPU info for delta calculation
let prevCpuInfo = null;

// Previous network stats for throughput
let prevNetStats = null;

// GPU cache
let cachedGpu = null;
let gpuTick = 0;

// Helper
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

async function loadHardwareInfo() {
  const [cpuInfo, memLayout, diskLayout] = await Promise.all([
    withTimeout(si.cpu(), 8000, null),
    withTimeout(si.memLayout(), 8000, []),
    withTimeout(si.diskLayout(), 8000, [])
  ]);
  hwCpu = cpuInfo?.brand || 'Unknown';
  hwMemory = memLayout;
  hwDiskLayout = diskLayout;
}

async function sampleCpu() {
  const cpus = os.cpus();
  const current = cpus.map(c => ({ idle: c.times.idle, total: c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq }));
  const usage = [];
  if (prevCpuInfo) {
    for (let i = 0; i < cpus.length; i++) {
      const dIdle = current[i].idle - prevCpuInfo[i].idle;
      const dTotal = current[i].total - prevCpuInfo[i].total;
      usage.push(cpuCoreUsage(dIdle, dTotal));
    }
  } else {
    usage.push(...cpus.map(() => 0));
  }
  prevCpuInfo = current;
  return {
    average: cpuAverage(usage),
    cores: cpus.map((c, i) => ({ usage: usage[i] || 0, model: c.model }))
  };
}

async function sampleMemory() {
  const { total, free } = os;
  const used = total - free;
  return {
    total: total / 1024 / 1024 / 1024,
    free: free / 1024 / 1024 / 1024,
    used: used / 1024 / 1024 / 1024,
    usedPercent: memUsedPercent()
  };
}

async function sampleDisk() {
  const drives = [];
  const layout = hwDiskLayout;
  for (const d of layout) {
    if (d.size > 0) { // skip CD-ROM
      const { size, used } = await withTimeout(si.fsSize(d.device), 5000, { size: 0, used: 0 });
      drives.push({
        filesystem: d.name,
        mount: d.mount,
        type: d.type,
        size: size / 1024 / 1024 / 1024,
        used: used / 1024 / 1024 / 1024,
        available: (size - used) / 1024 / 1024 / 1024,
        use: diskUsedPercent(d.mount)
      });
    }
  }
  const ioUtil = await withTimeout(si.disksIO(), 3000, null);
  return { drives, ioUtil };
}

async function sampleNetwork() {
  let interfaces = await withTimeout(si.networkInterfaces(), 5000, []);
  if (!interfaces.length) {
    // Windows fallback
    interfaces = Object.values(os.networkInterfaces()).flat().filter(i => i && !i.internal);
  }
  const stats = await withTimeout(si.networkStats(), 5000, []);
  const ethernet = [];
  const wifi = [];
  for (const iface of interfaces) {
    if (!iface.mac || iface.mac === '00:00:00:00:00:00') continue;
    const stat = stats.find(s => s.iface === iface.iface) || {};
    const prev = prevNetStats?.find(p => p.iface === iface.iface) || {};
    const isWifi = WIFI_IFACE_RE.test(iface.iface);
    const entry = {
      iface: iface.iface,
      rx_bytes: stat.rx_bytes || 0,
      tx_bytes: stat.tx_bytes || 0,
      rx_sec: bytesThroughput((stat.rx_bytes || 0) - (prev.rx_bytes || 0)),
      tx_sec: bytesThroughput((stat.tx_bytes || 0) - (prev.tx_bytes || 0))
    };
    if (isWifi) wifi.push(entry);
    else ethernet.push(entry);
  }
  prevNetStats = stats;
  return { ethernet, wifi };
}

async function sampleProcesses() {
  const cmd = buildPsCommand();
  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000 });
    const lines = stdout.trim().split('\n').slice(0, 10); // top 10
    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        pid: parts[0],
        name: parts.slice(1).join(' '),
        cpu: parseFloat(parts[parts.length - 2]) || 0,
        memory: parseFloat(parts[parts.length - 1]) || 0
      };
    });
  } catch {
    return [];
  }
}

async function sampleGpu() {
  const gpus = [];
  try {
    const graphics = await withTimeout(si.graphics(), 5000, { controllers: [] });
    for (const ctrl of graphics.controllers) {
      if (ctrl.vendor && ctrl.model) {
        gpus.push({
          vendor: ctrl.vendor,
          model: ctrl.model,
          vram: ctrl.vram || null,
          temperatureGpu: ctrl.temperatureGpu || null,
          utilizationGpu: ctrl.utilizationGpu || null,
          utilizationMemory: ctrl.utilizationMemory || null
        });
      }
    }
  } catch {}
  return gpus;
}

// GPU runs in the background — never blocks disk/network collection
let gpuSampling = false;
function triggerGpuSample() {
  if (gpuSampling) return;
  gpuSampling = true;
  sampleGpu().then(g => { cachedGpu = g; }).finally(() => { gpuSampling = false; });
}

async function collectMetrics() {
  // GPU: fire without awaiting so it never stalls disk/network
  gpuTick = (gpuTick + 1) % 5;
  if (gpuTick === 0 || cachedGpu === null) triggerGpuSample();

  const [disk, network, processes] = await Promise.all([sampleDisk(), sampleNetwork(), sampleProcesses()]);

  cachedMetrics = {
    cpu: { ...await sampleCpu(), model: hwCpu },
    memory: { ...await sampleMemory(), layout: hwMemory },
    uptime: floorSeconds(os.uptime()),
    disk: { drives: disk.drives, ioUtil: disk.ioUtil, layout: hwDiskLayout },
    network,
    gpu: cachedGpu ?? [],
    processes,
    timestamp: Date.now(),
  };
  return cachedMetrics;
}

// Collect once per second
setInterval(collectMetrics, 1000);
collectMetrics(); // initial
loadHardwareInfo(); // fire without blocking the metrics loop

export function getMetrics() { return cachedMetrics; }

// ─── Subscriptions map: ws → Set<'cpu'|'memory'|'all'> ───────────────────────
const subscriptions = new Map();

export function setupMonitorWs(wss) {
  wss.on('connection', (ws, req) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    // Initial subscription from URL path
    let initial = new Set();
    if (pathname === '/ws/cpu') initial.add('cpu');
    else if (pathname === '/ws/memory') initial.add('memory');
    else if (pathname === '/ws/all') initial.add('all');

    subscriptions.set(ws, initial);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.action === 'subscribe' && Array.isArray(msg.metrics)) {
          subscriptions.set(ws, new Set(msg.metrics));
        } else if (msg.action === 'unsubscribe' && Array.isArray(msg.metrics)) {
          const subs = subscriptions.get(ws) || new Set();
          msg.metrics.forEach(m => subs.delete(m));
          subscriptions.set(ws, subs);
        } else {
          ws.send(JSON.stringify({ error: 'invalid_message' }));
        }
      } catch {
        ws.send(JSON.stringify({ error: 'invalid_json' }));
      }
    });

    ws.on('close', () => subscriptions.delete(ws));
    ws.on('error', () => subscriptions.delete(ws));
  });

  // Broadcast every second
  setInterval(() => {
    const metrics = cachedMetrics;
    for (const [ws, subs] of subscriptions) {
      if (ws.readyState !== 1) { subscriptions.delete(ws); continue; }
      let payload = null;
      if (subs.has('all')) payload = metrics;
      else {
        payload = {};
        if (subs.has('cpu')) payload.cpu = metrics.cpu;
        if (subs.has('memory')) payload.memory = metrics.memory;
        if (subs.has('uptime')) payload.uptime = metrics.uptime;
        if (subs.has('disk')) payload.disk = metrics.disk;
        if (subs.has('network')) payload.network = metrics.network;
        if (subs.has('gpu')) payload.gpu = metrics.gpu;
        if (subs.has('processes')) payload.processes = metrics.processes;
        payload.timestamp = metrics.timestamp;
        payload.convertedUptime = _convertDate(metrics.uptime);
      }
      if (payload && Object.keys(payload).length > 1) {
        ws.send(JSON.stringify(payload));
      }
    }
  }, 1000);
}