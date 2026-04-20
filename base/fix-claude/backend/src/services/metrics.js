import os from 'os';
import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile } from 'fs/promises';
import {
  cpuCoreUsage, cpuAverage, memUsedPercent, diskUsedPercent,
  bytesThroughput, floorSeconds, convertDate,
  WIFI_IFACE_RE, PS_GPU_UTIL, buildPsCommand, NVIDIA_SMI_CMD,
  DRM_CARD_RE, parseGpuUtilOutput,
} from '../utils.js';
import {
  METRICS_INTERVAL_MS, GPU_SAMPLE_EVERY_N_TICKS, TOP_PROCESSES_COUNT,
  TIMEOUT_FS_SIZE, TIMEOUT_DISK_IO, TIMEOUT_NETWORK, TIMEOUT_GPU,
  TIMEOUT_HARDWARE, TIMEOUT_PROCESSES, TIMEOUT_PDH, TIMEOUT_NVIDIA_SMI,
} from '../config.js';

const execAsync = promisify(exec);

// Resolve with fallback after `ms` ms so slow si calls never block the loop
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

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
    withTimeout(si.cpu(), TIMEOUT_HARDWARE, null),
    withTimeout(si.memLayout(), TIMEOUT_HARDWARE, []),
    withTimeout(si.diskLayout(), TIMEOUT_HARDWARE, []),
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

// CPU usage requires two samples
let prevCpuInfo = os.cpus().map(c => ({
  idle: c.times.idle,
  total: Object.values(c.times).reduce((a, b) => a + b, 0),
}));

function sampleCpu() {
  const cpus = os.cpus();
  const current = cpus.map(c => ({
    idle: c.times.idle,
    total: Object.values(c.times).reduce((a, b) => a + b, 0),
  }));
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
      withTimeout(si.fsSize(), TIMEOUT_FS_SIZE, []),
      withTimeout(si.disksIO(), TIMEOUT_DISK_IO, null),
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
      withTimeout(si.networkInterfaces(), TIMEOUT_NETWORK, []),
      withTimeout(si.networkStats(), TIMEOUT_NETWORK, []),
    ]);

    const ifaceList = Array.isArray(ifaces) ? ifaces : [];
    const statList = Array.isArray(stats) ? stats : [];

    const typeMap = {};
    const speedMap = {};
    for (const iface of ifaceList) {
      typeMap[iface.iface] = iface.type;
      speedMap[iface.iface] = iface.speed;
    }

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

// GPU: sampled less frequently (every N ticks) to avoid overhead
let cachedGpu = null;
let gpuTick = 0;

async function queryGpuUtilization() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(buildPsCommand(PS_GPU_UTIL), { timeout: TIMEOUT_PDH });
      return parseGpuUtilOutput(stdout);
    }

    // Linux — NVIDIA via nvidia-smi
    try {
      const { stdout } = await execAsync(NVIDIA_SMI_CMD, { timeout: TIMEOUT_NVIDIA_SMI });
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
    const data = await withTimeout(si.graphics(), TIMEOUT_GPU, { controllers: [] });
    const controllers = Array.isArray(data.controllers) ? data.controllers : [];
    if (controllers.length === 0) return [];

    let pdhUtil = null;
    const needsPdh = controllers.some(g => g.utilizationGpu == null);
    if (needsPdh) pdhUtil = await queryGpuUtilization();

    return controllers.map(g => ({
      model: g.model,
      vendor: g.vendor,
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
    const data = await withTimeout(si.processes(), TIMEOUT_PROCESSES, { list: [] });
    return (data.list ?? [])
      .sort((a, b) => b.memRss - a.memRss)
      .slice(0, TOP_PROCESSES_COUNT)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        mem: p.memRss,
        memPercent: p.mem,
        cpu: p.cpu ?? 0,
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
  gpuTick = (gpuTick + 1) % GPU_SAMPLE_EVERY_N_TICKS;
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

export function getMetrics() { return cachedMetrics; }
export { convertDate };

// Start collection loop
setInterval(collectMetrics, METRICS_INTERVAL_MS);
collectMetrics();
loadHardwareInfo();
