// ─── CPU ──────────────────────────────────────────────────────────────────────

/** Usage % for a single core given idle and total tick deltas. */
export function cpuCoreUsage(dIdle, dTotal) {
  return dTotal === 0 ? 0 : Math.round((1 - dIdle / dTotal) * 100);
}

/** Average usage % across all cores. */
export function cpuAverage(cores) {
  return Math.round(cores.reduce((a, b) => a + b, 0) / cores.length);
}

// ─── Memory ───────────────────────────────────────────────────────────────────

/** Used memory as a percentage of total. */
export function memUsedPercent(total, free) {
  return Math.round(((total - free) / total) * 100);
}

// ─── Disk ─────────────────────────────────────────────────────────────────────

/** Used disk space as a percentage. Prefers the pre-computed `use` field when available. */
export function diskUsedPercent(use, used, size) {
  return use != null ? Math.round(use) : Math.round((used / size) * 100);
}

// ─── Network ──────────────────────────────────────────────────────────────────

/** Bytes transferred per second between two samples (floors at 0). */
export function bytesThroughput(current, previous) {
  return Math.max(0, current - previous);
}

/** Matches interface names that identify a Wi-Fi adapter. */
export const WIFI_IFACE_RE = /wi.?fi|wlan|wifi/i;

// ─── GPU — cross-platform utilization query ───────────────────────────────────

/**
 * PowerShell script that sums GPU Engine 3D-type utilization via Windows PDH
 * counters. Works for Intel, AMD and NVIDIA as long as their drivers are installed.
 */
export const PS_GPU_UTIL =
  `$s=(Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage'` +
  ` -MaxSamples 1 -ErrorAction SilentlyContinue).CounterSamples;` +
  `if(!$s){Write-Output -1;exit};` +
  `$t=($s|Measure-Object CookedValue -Sum).Sum;` +
  `Write-Output ([math]::Round([math]::Min($t,100),1))`;

/** Wraps a one-liner script in the standard PowerShell non-interactive prefix. */
export function buildPsCommand(script) {
  return `powershell -NoProfile -NonInteractive -Command "${script}"`;
}

/** nvidia-smi invocation that prints a bare utilization percentage on Linux. */
export const NVIDIA_SMI_CMD =
  'nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits';

/**
 * Matches Linux DRM card directory names (card0, card1, …).
 * Used to enumerate /sys/class/drm for the sysfs GPU utilization fallback.
 */
export const DRM_CARD_RE = /^card\d+$/;

/** Parses the stdout of any GPU utilization query into a 0–100 number or null. */
export function parseGpuUtilOutput(stdout) {
  const val = parseFloat(stdout.trim());
  return (isNaN(val) || val < 0) ? null : val;
}

// ─── Uptime ───────────────────────────────────────────────────────────────────

/** Truncates fractional seconds from an uptime value. */
export function floorSeconds(seconds) {
  return Math.floor(seconds);
}

/** Formats a seconds value as "Xh Ym Zs". */
export function convertDate(seconds) {
  const d = new Date(seconds * 1000);
  return `${d.getUTCHours()}h ${d.getUTCMinutes()}m ${d.getUTCSeconds()}s`;
}
