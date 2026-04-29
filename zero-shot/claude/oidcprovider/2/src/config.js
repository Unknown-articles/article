export const PORT = process.env.PORT || 3000;
export const ISSUER = process.env.ISSUER || `http://localhost:${PORT}`;
export const DB_PATH = process.env.DB_PATH || './oidc.db';
export const TOKEN_TTL = 3600; // seconds
export const CODE_TTL = 600;   // seconds
