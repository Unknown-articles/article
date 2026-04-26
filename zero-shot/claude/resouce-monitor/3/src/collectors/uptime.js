import os from 'os';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export function collectUptime() {
  const uptimeSeconds = os.uptime();
  return {
    uptimeSeconds,
    formatted: formatUptime(uptimeSeconds),
    processUptimeSeconds: parseFloat(process.uptime().toFixed(3)),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
  };
}
