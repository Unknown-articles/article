import os from 'os';
import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile } from 'fs/promises';
import {
  cpuCoreUsage,
  cpuAverage,
  memUsedPercent,
  diskUsedPercent,
  bytesThroughput,
  floorSeconds,
  convertDate,
  WIFI_IFACE_RE,
  PS_GPU_UTIL,
  buildPsCommand,
  NVIDIA_SMI_CMD,
  DRM_CARD_RE,
  parseGpuUtilOutput,
} from '../utils.js';
import { config } from '../config.js';

const execAsync = promisify(exec);

let cachedMetrics = {
  cpu: null,
  memory: null,
  uptime: null,
  disk: { drives: [], ioUtil: null, layout: [] },
  network: { ethernet: [], wifi: [] },
  gpu: [],
  processes: [],
  timestamp: Date.now(),
};

let hwCpu = null;
let hwMemory = [];
let hwDiskLayout = [];
let prevNetStats = {};
let cachedGpu = null;
let gpuTick = 0;
let gpuSampling = false;

let prevCpuInfo = os.cpus().map(cpu => ({
  idle: cpu.times.idle,
  total: Object.values(cpu.times).reduce((sum, value) => sum + value, 0),
}));

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function loadHardwareInfo() {
  const [cpuInfo, memLayout, diskLayout] = await Promise.all([
    withTimeout(si.cpu(), config.slowOperationTimeoutMs, null),
    withTimeout(si.memLayout(), config.slowOperationTimeoutMs, []),
    withTimeout(si.diskLayout(), config.slowOperationTimeoutMs, []),
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

  hwMemory = (Array.isArray(memLayout) ? memLayout : []).map(memory => ({
    manufacturer: memory.manufacturer,
    type: memory.type,
    clockSpeed: memory.clockSpeed,
    size: memory.size,
    formFactor: memory.formFactor,
  }));

  hwDiskLayout = (Array.isArray(diskLayout) ? diskLayout : []).map(disk => ({
    vendor: disk.vendor,
    name: disk.name,
    type: disk.type,
    size: disk.size,
    interfaceType: disk.interfaceType,
  }));
}

function sampleCpu() {
  const cpus = os.cpus();
  const current = cpus.map(cpu => ({
    idle: cpu.times.idle,
    total: Object.values(cpu.times).reduce((sum, value) => sum + value, 0),
  }));
  const usage = current.map((cpu, index) => {
    const idleDelta = cpu.idle - prevCpuInfo[index].idle;
    const totalDelta = cpu.total - prevCpuInfo[index].total;
    return cpuCoreUsage(idleDelta, totalDelta);
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
      withTimeout(si.fsSize(), config.ioTimeoutMs, []),
      withTimeout(si.disksIO(), config.quickCommandTimeoutMs, null),
    ]);

    return {
      drives: fsSizes
        .filter(drive => drive.size > 0)
        .map(drive => ({
          fs: drive.fs,
          mount: drive.mount,
          type: drive.type,
          size: drive.size,
          used: drive.used,
          available: drive.available,
          usedPercent: diskUsedPercent(drive.use, drive.used, drive.size),
        })),
      ioUtil: io?.util ?? null,
    };
  } catch {
    return { drives: [], ioUtil: null };
  }
}

async function sampleNetwork() {
  try {
    const [ifaces, stats] = await Promise.all([
      withTimeout(si.networkInterfaces(), config.ioTimeoutMs, []),
      withTimeout(si.networkStats(), config.ioTimeoutMs, []),
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
      : ifaceList
          .filter(iface => iface.operstate === 'up')
          .map(iface => ({
            iface: iface.iface,
            rx_bytes: 0,
            tx_bytes: 0,
            operstate: iface.operstate,
          }));

    const result = { ethernet: [], wifi: [] };

    for (const stat of sources) {
      if (!stat.iface) continue;
      const prev = prevNetStats[stat.iface] || { rx_bytes: stat.rx_bytes, tx_bytes: stat.tx_bytes };
      prevNetStats[stat.iface] = { rx_bytes: stat.rx_bytes, tx_bytes: stat.tx_bytes };

      const entry = {
        iface: stat.iface,
        rx_bytes: stat.rx_bytes,
        tx_bytes: stat.tx_bytes,
        rx_sec: bytesThroughput(stat.rx_bytes, prev.rx_bytes),
        tx_sec: bytesThroughput(stat.tx_bytes, prev.tx_bytes),
        operstate: stat.operstate,
        speed: speedMap[stat.iface] ?? null,
      };

      const ifaceType = (typeMap[stat.iface] || '').toLowerCase();
      if (ifaceType === 'wireless' || WIFI_IFACE_RE.test(stat.iface)) {
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

async function queryGpuUtilization() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(buildPsCommand(PS_GPU_UTIL), {
        timeout: config.slowOperationTimeoutMs,
      });
      return parseGpuUtilOutput(stdout);
    }

    try {
      const { stdout } = await execAsync(NVIDIA_SMI_CMD, { timeout: config.ioTimeoutMs });
      return parseGpuUtilOutput(stdout);
    } catch {}

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
    const data = await withTimeout(si.graphics(), config.gpuQueryTimeoutMs, { controllers: [] });
    const controllers = Array.isArray(data.controllers) ? data.controllers : [];
    if (controllers.length === 0) return [];

    let pdhUtil = null;
    if (controllers.some(controller => controller.utilizationGpu == null)) {
      pdhUtil = await queryGpuUtilization();
    }

    return controllers.map(controller => ({
      model: controller.model,
      vendor: controller.vendor,
      vram: controller.vram ?? 0,
      vramDynamic: controller.vramDynamic ?? (controller.vram === 0),
      utilizationGpu:
        controller.utilizationGpu ?? (controllers.length === 1 ? pdhUtil : null),
      utilizationMemory: controller.utilizationMemory ?? null,
      temperatureGpu: controller.temperatureGpu ?? null,
    }));
  } catch {
    return [];
  }
}

async function sampleProcesses() {
  try {
    const data = await withTimeout(si.processes(), config.ioTimeoutMs, { list: [] });
    return (data.list ?? [])
      .sort((left, right) => right.memRss - left.memRss)
      .slice(0, config.processSampleLimit)
      .map(processInfo => ({
        pid: processInfo.pid,
        name: processInfo.name,
        mem: processInfo.memRss,
        memPercent: processInfo.mem,
        cpu: processInfo.cpu ?? 0,
        state: processInfo.state,
        user: processInfo.user,
      }));
  } catch {
    return [];
  }
}

function triggerGpuSample() {
  if (gpuSampling) return;
  gpuSampling = true;
  sampleGpu()
    .then(gpu => {
      cachedGpu = gpu;
    })
    .finally(() => {
      gpuSampling = false;
    });
}

export async function collectMetrics() {
  gpuTick = (gpuTick + 1) % config.gpuSamplingIntervalTicks;
  if (gpuTick === 0 || cachedGpu === null) triggerGpuSample();

  const [disk, network, processes] = await Promise.all([
    sampleDisk(),
    sampleNetwork(),
    sampleProcesses(),
  ]);

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

export function getMetrics() {
  return cachedMetrics;
}

export function startMetricsCollection() {
  setInterval(collectMetrics, config.metricsIntervalMs);
  collectMetrics();
  loadHardwareInfo();
}

export function buildMetricsPayload(metrics, subscriptions) {
  if (subscriptions.has('all')) return metrics;

  const payload = {};
  if (subscriptions.has('cpu')) payload.cpu = metrics.cpu;
  if (subscriptions.has('memory')) payload.memory = metrics.memory;
  if (subscriptions.has('uptime')) payload.uptime = metrics.uptime;
  if (subscriptions.has('disk')) payload.disk = metrics.disk;
  if (subscriptions.has('network')) payload.network = metrics.network;
  if (subscriptions.has('gpu')) payload.gpu = metrics.gpu;
  if (subscriptions.has('processes')) payload.processes = metrics.processes;
  payload.timestamp = metrics.timestamp;
  payload.convertedUptime = convertDate(metrics.uptime);
  return payload;
}
