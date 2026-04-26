import os from 'os';

export function collectMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: parseFloat(((usedBytes / totalBytes) * 100).toFixed(2)),
    totalMB: parseFloat((totalBytes / 1024 / 1024).toFixed(2)),
    freeMB: parseFloat((freeBytes / 1024 / 1024).toFixed(2)),
    usedMB: parseFloat((usedBytes / 1024 / 1024).toFixed(2)),
  };
}
