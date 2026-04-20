import path from "node:path";
import { statfs } from "node:fs/promises";

function resolveRootPath() {
  if (process.platform === "win32") {
    return path.parse(process.cwd()).root;
  }

  return "/";
}

export async function getDiskUsage() {
  const root = resolveRootPath();

  try {
    const stats = await statfs(root);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    const used = total - free;

    return {
      path: root.replace(/\\$/, ""),
      total,
      used,
      free,
      usagePercent: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0
    };
  } catch {
    return {
      path: root.replace(/\\$/, ""),
      total: null,
      used: null,
      free: null,
      usagePercent: null,
      error: "Disk usage unavailable"
    };
  }
}

export function formatBytes(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(2)} ${units[index]}`;
}
