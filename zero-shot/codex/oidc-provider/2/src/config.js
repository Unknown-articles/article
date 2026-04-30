export const PORT = Number(process.env.PORT || 4000);
export const ISSUER = process.env.ISSUER || `http://localhost:${PORT}`;
export const DB_PATH = process.env.DB_PATH || new URL('../data/oidc.sqlite', import.meta.url).pathname;

export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const AUTH_CODE_TTL_SECONDS = 600;
