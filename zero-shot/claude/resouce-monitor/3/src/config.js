export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
export const COLLECT_INTERVAL_MS = 1000;
export const VALID_METRIC_TYPES = ['cpu', 'memory', 'disk', 'uptime'];
export const VALID_WS_TYPES = ['all', ...VALID_METRIC_TYPES];
