import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import oidcRouter from './routes/oidc.js';
import metricsRouter from './routes/metrics.js';
import genericApiRouter from './routes/genericApi.js';
// import { setupMonitorWs } from './ws/monitor.js';
import { setupChatWs } from './ws/chat.js';
import os from 'os';
import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile } from 'fs/promises';
import {cpuCoreUsage, cpuAverage, memUsedPercent, diskUsedPercent, bytesThroughput, floorSeconds, convertDate as _convertDate, WIFI_IFACE_RE, PS_GPU_UTIL, buildPsCommand, NVIDIA_SMI_CMD, DRM_CARD_RE, parseGpuUtilOutput,} from './utils.js';

const app = express();
const server = createServer(app);

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/', oidcRouter);
app.use('/metrics', metricsRouter);
app.use('/', genericApiRouter);

const monitorWss = new WebSocketServer({ noServer: true });
const chatWss = new WebSocketServer({ noServer: true });
setupMonitorWs(monitorWss);
setupChatWs(chatWss);

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/ws/chat') {
    chatWss.handleUpgrade(req, socket, head, ws => chatWss.emit('connection', ws, req));
  } else if (['/ws/cpu', '/ws/memory', '/ws/all', '/ws/disk', '/ws/network', '/ws/gpu'].some(p => pathname.startsWith(p))) {
    monitorWss.handleUpgrade(req, socket, head, ws => monitorWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
export { server };

export { _convertDate as convertDate };



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

async function loadHardwareInfo() {
  const [cpuInfo, memLayout, diskLayout] = await Promise.all([
    withTimeout(si.cpu(), 8000, null),
    withTimeout(si.memLayout(), 8000, []),
    withTimeout(si.diskLayout(), 8000, []),
  ]);

  if (cpuInfo) {
    hwCpu = {
      brand: cpuInfo.brand,
      manufacturer: cpuInfo.manufacturer,
      speed: cpuInfo.speed,
      speedMax: cpuInfo.speedMax,
      cores: cpuInfo.cores,
      physicalCores: cpuInfo.physicalCores,
    };
  }

  hwMemory = (Array.isArray(memLayout) ? memLayout : []).map(m => ({
    manufacturer: m.manufacturer,
    type: m.type,
    clockSpeed: m.clockSpeed,
    size: m.size,
    formFactor: m.formFactor,
  }));

  hwDiskLayout = (Array.isArray(diskLayout) ? diskLayout : []).map(d => ({
    vendor: d.vendor,
    name: d.name,
    type: d.type,
    size: d.size,
    interfaceType: d.interfaceType,
  }));
}

// Resolve with fallback after `ms` ms so slow si calls never block the loop
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// CPU usage requires two samples
let prevCpuInfo = os.cpus().map(c => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));

function sampleCpu() {
  const cpus = os.cpus();
  const current = cpus.map(c => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));
  const usage = current.map((c, i) => {
    const dIdle = c.idle - prevCpuInfo[i].idle;
    const dTotal = c.total - prevCpuInfo[i].total;
    return cpuCoreUsage(dIdle, dTotal);
  });
  prevCpuInfo = current;
  return { cores: usage, average: cpuAverage(usage) };
}

function sampleMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  return { total, free, used: total - free, usedPercent: memUsedPercent(total, free) };
}

async function sampleDisk() {
  try {
    const [fsSizes, io] = await Promise.all([
      withTimeout(si.fsSize(), 5000, []),
      withTimeout(si.disksIO(), 3000, null),
    ]);
    return {
      drives: fsSizes
        .filter(d => d.size > 0)
        .map(d => ({
          fs: d.fs,
          mount: d.mount,
          type: d.type,
          size: d.size,
          used: d.used,
          available: d.available,
          usedPercent: diskUsedPercent(d.use, d.used, d.size),
        })),
      ioUtil: io?.util ?? null,
    };
  } catch {
    return { drives: [], ioUtil: null };
  }
}

// Network: track previous bytes to compute per-second throughput
let prevNetStats = {};

async function sampleNetwork() {
  try {
    const [ifaces, stats] = await Promise.all([
      withTimeout(si.networkInterfaces(), 5000, []),
      withTimeout(si.networkStats(), 5000, []),
    ]);

    const ifaceList = Array.isArray(ifaces) ? ifaces : [];
    const statList = Array.isArray(stats) ? stats : [];

    // Build a lookup: iface name → type from networkInterfaces
    const typeMap = {};
    const speedMap = {};
    for (const iface of ifaceList) {
      typeMap[iface.iface] = iface.type;   // 'wired' | 'wireless' | 'virtual' | ...
      speedMap[iface.iface] = iface.speed; // Mbps
    }

    // If networkStats returned nothing, fall back to networkInterfaces data
    const sources = statList.length > 0
      ? statList
      : ifaceList.filter(i => i.operstate === 'up').map(i => ({
          iface: i.iface,
          rx_bytes: 0,
          tx_bytes: 0,
          operstate: i.operstate,
        }));

    const result = { ethernet: [], wifi: [] };

    for (const s of sources) {
      if (!s.iface) continue;
      const prev = prevNetStats[s.iface] || { rx_bytes: s.rx_bytes, tx_bytes: s.tx_bytes };
      const rxSec = bytesThroughput(s.rx_bytes, prev.rx_bytes);
      const txSec = bytesThroughput(s.tx_bytes, prev.tx_bytes);
      prevNetStats[s.iface] = { rx_bytes: s.rx_bytes, tx_bytes: s.tx_bytes };

      const entry = {
        iface: s.iface,
        rx_bytes: s.rx_bytes,
        tx_bytes: s.tx_bytes,
        rx_sec: rxSec,
        tx_sec: txSec,
        operstate: s.operstate,
        speed: speedMap[s.iface] ?? null,
      };

      const ifaceType = (typeMap[s.iface] || '').toLowerCase();
      if (ifaceType === 'wireless' || WIFI_IFACE_RE.test(s.iface)) {
        result.wifi.push(entry);
      } else if (ifaceType !== 'virtual' && ifaceType !== 'loopback') {
        result.ethernet.push(entry);
      }
    }

    return result;
  } catch {
    return { ethernet: [], wifi: [] };
  }
}

// GPU: sampled less frequently (every 5 s) to avoid overhead
let cachedGpu = null;
let gpuTick = 0;

// Cross-platform GPU utilization query.
// Windows : Windows PDH counters via PowerShell (Intel, AMD, NVIDIA).
// Linux   : nvidia-smi (NVIDIA) → sysfs gpu_busy_percent (Intel i915 / AMD amdgpu).
async function queryGpuUtilization() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(buildPsCommand(PS_GPU_UTIL), { timeout: 8000 });
      return parseGpuUtilOutput(stdout);
    }

    // Linux — NVIDIA via nvidia-smi
    try {
      const { stdout } = await execAsync(NVIDIA_SMI_CMD, { timeout: 5000 });
      return parseGpuUtilOutput(stdout);
    } catch { /* nvidia-smi not available, try sysfs */ }

    // Linux — Intel i915 / AMD amdgpu via sysfs
    const cards = await readdir('/sys/class/drm').catch(() => []);
    for (const card of cards.sort()) {
      if (!DRM_CARD_RE.test(card)) continue;
      const content = await readFile(`/sys/class/drm/${card}/device/gpu_busy_percent`, 'utf8').catch(() => null);
      if (content != null) return parseGpuUtilOutput(content);
    }

    return null;
  } catch {
    return null;
  }
}

async function sampleGpu() {
  try {
    // 15 s timeout — WMI on Windows can be very slow
    const data = await withTimeout(si.graphics(), 15000, { controllers: [] });
    const controllers = Array.isArray(data.controllers) ? data.controllers : [];
    if (controllers.length === 0) return [];

    // For each controller, try to fill utilization from si first,
    // then fall back to Windows PDH counters (works for Intel, AMD, NVIDIA).
    let pdhUtil = null;
    const needsPdh = controllers.some(g => g.utilizationGpu == null);
    if (needsPdh) pdhUtil = await queryGpuUtilization();

    return controllers.map(g => ({
      model: g.model,
      vendor: g.vendor,
      // vram=0 means dynamic shared memory (Intel integrated)
      vram: g.vram ?? 0,
      vramDynamic: g.vramDynamic ?? (g.vram === 0),
      utilizationGpu: g.utilizationGpu ?? (controllers.length === 1 ? pdhUtil : null),
      utilizationMemory: g.utilizationMemory ?? null,
      temperatureGpu: g.temperatureGpu ?? null,
    }));
  } catch {
    return [];
  }
}

async function sampleProcesses() {
  try {
    const data = await withTimeout(si.processes(), 5000, { list: [] });
    return (data.list ?? [])
      .sort((a, b) => b.memRss - a.memRss)
      .slice(0, 10)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        mem: p.memRss,       // KB
        memPercent: p.mem,   // % of total RAM
        cpu: p.cpu ?? 0,     // % CPU
        state: p.state,
        user: p.user,
      }));
  } catch {
    return [];
  }
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
    cpu: { ...sampleCpu(), model: hwCpu },
    memory: { ...sampleMemory(), layout: hwMemory },
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
        payload.convertedUptime = convertDate(metrics.uptime);
      }
      if (payload && Object.keys(payload).length > 1) {
        ws.send(JSON.stringify(payload));
      }
    }
  }, 1000);
}