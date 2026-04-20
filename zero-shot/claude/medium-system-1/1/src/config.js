import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

export const PORT = process.env.PORT || 3000;
export const ISSUER = process.env.ISSUER || `http://localhost:${PORT}`;
export const DB_PATH = join(ROOT, 'database.sqlite');
export const DATA_PATH = join(ROOT, 'data.json');
export const ACCESS_TOKEN_TTL = 3600;   // seconds
export const AUTH_CODE_TTL = 600;       // seconds
export const KEY_ID = 'key-1';
