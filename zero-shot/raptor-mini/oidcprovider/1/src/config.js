import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const issuerUrl = process.env.ISSUER || `http://localhost:${port}`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = process.env.DATA_DIR || join(__dirname, '../data');

export const PORT = port;
export const ISSUER_URL = issuerUrl;
export const DATA_DIR = dataDir;
export const TOKEN_EXPIRATION_SECONDS = 3600;
export const AUTH_CODE_EXPIRATION_SECONDS = 600;
export const CLIENTS = [
  {
    client_id: 'test-client',
    client_secret: 'test-secret',
    redirect_uris: ['http://localhost:8080/callback', 'http://localhost:3001/callback']
  }
];
export const USERS = [
  {
    username: 'testuser',
    password: 'password123',
    email: 'testuser@example.com',
    name: 'Test User'
  }
];
export const ALLOWED_RESPONSE_TYPES = ['code'];
export const RESPONSE_TYPES_SUPPORTED = ['code'];
export const SUBJECT_TYPES_SUPPORTED = ['public'];
export const ID_TOKEN_SIGNING_ALG_VALUES_SUPPORTED = ['RS256'];
