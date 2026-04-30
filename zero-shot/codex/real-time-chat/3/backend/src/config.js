import path from 'node:path';
import process from 'node:process';

export const PORT = Number(process.env.PORT || 5000);
export const DB_PATH = process.env.DB_PATH || './chat.db';
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
export const FRONTEND_ORIGINS = [
  FRONTEND_ORIGIN,
  'http://localhost:5273',
  'http://127.0.0.1:5273',
];
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-chat-secret-change-me';

export function resolveDbPath() {
  return path.resolve(process.cwd(), DB_PATH);
}
