import { METRIC_TYPES } from "../config.js";

export const WS_PATHS = {
  "/ws/cpu": ["cpu"],
  "/ws/memory": ["memory"],
  "/ws/all": METRIC_TYPES
};

export function isSupportedPath(pathname) {
  return Object.hasOwn(WS_PATHS, pathname);
}

export function normalizeMetrics(metrics = []) {
  return [...new Set(metrics.filter((metric) => METRIC_TYPES.includes(metric)))];
}

export function getDefaultSubscriptions(pathname) {
  return normalizeMetrics(WS_PATHS[pathname] ?? []);
}

export function buildMetricsPayload(snapshot, metrics) {
  const selectedMetrics = normalizeMetrics(metrics);

  return selectedMetrics.reduce(
    (payload, metric) => {
      payload[metric] = snapshot[metric];
      return payload;
    },
    { timestamp: snapshot.timestamp }
  );
}
