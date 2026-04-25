import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

export const metricsEmitter = new EventEmitter();

let cachedMetrics = {
    cpu: 0,
    memory: { total: 0, free: 0, usedPercentage: 0 },
    disk: { total: 0, free: 0, usedPercentage: 0 },
    uptime: 0
};

let previousCpu = getCpuTimes();
let intervalId = null;

function getCpuTimes() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (let cpu of cpus) {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    }
    return {
        idle,
        total: user + nice + sys + idle + irq
    };
}

async function collectMetrics() {
    // 1. CPU
    const currentCpu = getCpuTimes();
    const idleDiff = currentCpu.idle - previousCpu.idle;
    const totalDiff = currentCpu.total - previousCpu.total;
    const cpuPercentage = totalDiff === 0 ? 0 : (100 - (100 * idleDiff / totalDiff));
    previousCpu = currentCpu;

    // 2. Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPercentage = ((totalMem - freeMem) / totalMem) * 100;

    // 3. Disk (Root drive)
    let diskMetrics = { total: 0, free: 0, usedPercentage: 0 };
    try {
        const rootPath = path.parse(process.cwd()).root || '/';
        const stats = await fs.statfs(rootPath);
        // statfs properties: bsize, blocks, bfree
        const total = Number(stats.blocks) * Number(stats.bsize);
        const free = Number(stats.bfree) * Number(stats.bsize);
        diskMetrics = {
            total,
            free,
            usedPercentage: total === 0 ? 0 : ((total - free) / total) * 100
        };
    } catch (e) {
        console.error('Error fetching disk metrics:', e.message);
    }

    // 4. Uptime
    const uptime = os.uptime();

    cachedMetrics = {
        cpu: parseFloat(cpuPercentage.toFixed(2)),
        memory: {
            total: totalMem,
            free: freeMem,
            usedPercentage: parseFloat(usedMemPercentage.toFixed(2))
        },
        disk: {
            total: diskMetrics.total,
            free: diskMetrics.free,
            usedPercentage: parseFloat(diskMetrics.usedPercentage.toFixed(2))
        },
        uptime
    };
    
    metricsEmitter.emit('update', cachedMetrics);
    
    return cachedMetrics;
}

export function startMetricsCollection(intervalMs = 1000) {
    if (intervalId) return;
    
    // Initial collection
    collectMetrics();
    
    intervalId = setInterval(() => {
        collectMetrics();
    }, intervalMs);
}

export function stopMetricsCollection() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

export function getLatestMetrics() {
    return cachedMetrics;
}
