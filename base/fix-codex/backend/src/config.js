const DEFAULT_PORT = 3001;
const DEFAULT_FRONTEND_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];
const DEFAULT_CLIENT_ID = 'default-client';

function parseOrigins(value) {
  if (!value) return DEFAULT_FRONTEND_ORIGINS;
  return value.split(',').map(origin => origin.trim()).filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || DEFAULT_PORT),
  frontendOrigins: parseOrigins(process.env.FRONTEND_ORIGINS),
  issuer: process.env.OIDC_ISSUER || `http://localhost:${process.env.PORT || DEFAULT_PORT}`,
  oidcClientId: process.env.OIDC_CLIENT_ID || DEFAULT_CLIENT_ID,
  oidcRedirectUri:
    process.env.OIDC_REDIRECT_URI || `${DEFAULT_FRONTEND_ORIGINS[0]}/callback`,
  metricsIntervalMs: Number(process.env.METRICS_INTERVAL_MS || 1000),
  slowOperationTimeoutMs: Number(process.env.SLOW_OPERATION_TIMEOUT_MS || 8000),
  ioTimeoutMs: Number(process.env.IO_TIMEOUT_MS || 5000),
  quickCommandTimeoutMs: Number(process.env.QUICK_COMMAND_TIMEOUT_MS || 3000),
  gpuSamplingIntervalTicks: Number(process.env.GPU_SAMPLING_INTERVAL_TICKS || 5),
  gpuQueryTimeoutMs: Number(process.env.GPU_QUERY_TIMEOUT_MS || 15000),
  processSampleLimit: Number(process.env.PROCESS_SAMPLE_LIMIT || 10),
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 3600),
  authCodeTtlMs: Number(process.env.AUTH_CODE_TTL_MS || 10 * 60 * 1000),
};
