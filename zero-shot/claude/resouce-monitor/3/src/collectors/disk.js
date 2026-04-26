import { execSync } from 'child_process';

function parseDfOutput() {
  const out = execSync('df -k /').toString();
  const lines = out.trim().split('\n');
  const parts = lines[lines.length - 1].trim().split(/\s+/);
  const totalBytes = parseInt(parts[1]) * 1024;
  const usedBytes = parseInt(parts[2]) * 1024;
  const freeBytes = parseInt(parts[3]) * 1024;
  return { totalBytes, usedBytes, freeBytes };
}

function parseWmicOutput() {
  const out = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:value')
    .toString();
  const free = parseInt(out.match(/FreeSpace=(\d+)/)?.[1] ?? '0');
  const total = parseInt(out.match(/Size=(\d+)/)?.[1] ?? '0');
  return { totalBytes: total, freeBytes: free, usedBytes: total - free };
}

export function collectDisk() {
  try {
    const { totalBytes, usedBytes, freeBytes } =
      process.platform === 'win32' ? parseWmicOutput() : parseDfOutput();

    return {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent: totalBytes > 0
        ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(2))
        : 0,
    };
  } catch (err) {
    return { error: `Could not read disk info: ${err.message}` };
  }
}
