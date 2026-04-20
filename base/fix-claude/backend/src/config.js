// ─── Server ───────────────────────────────────────────────────────────────────
export const PORT         = parseInt(process.env.PORT || '3001', 10);
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');

// ─── OIDC ─────────────────────────────────────────────────────────────────────
export const ISSUER               = process.env.ISSUER               || 'http://localhost:3001';
export const CLIENT_REDIRECT_URI  = process.env.CLIENT_REDIRECT_URI  || 'http://localhost:5173/callback';
export const TOKEN_EXPIRY_SECONDS = parseInt(process.env.TOKEN_EXPIRY_SECONDS || '3600', 10);
export const AUTH_CODE_EXPIRY_MS  = parseInt(process.env.AUTH_CODE_EXPIRY_MS  || String(10 * 60 * 1000), 10);

// ─── Metrics timing ───────────────────────────────────────────────────────────
export const METRICS_INTERVAL_MS      = 1000;
export const GPU_SAMPLE_EVERY_N_TICKS = 5;
export const TOP_PROCESSES_COUNT      = 10;

// ─── systeminformation timeouts (ms) ──────────────────────────────────────────
export const TIMEOUT_FS_SIZE    = 5000;
export const TIMEOUT_DISK_IO    = 3000;
export const TIMEOUT_NETWORK    = 5000;
export const TIMEOUT_GPU        = 15000;
export const TIMEOUT_HARDWARE   = 8000;
export const TIMEOUT_PROCESSES  = 5000;
export const TIMEOUT_PDH        = 8000;
export const TIMEOUT_NVIDIA_SMI = 5000;
