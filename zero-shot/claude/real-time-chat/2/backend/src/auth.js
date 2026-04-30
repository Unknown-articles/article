import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'chat_secret_key';

export function generateToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function register(username, password) {
  const hashed = await bcrypt.hash(password, 10);
  const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
  const result = stmt.run(username, hashed);
  return { userId: result.lastInsertRowid, username };
}

export async function login(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password);
  if (!match) return null;
  return { userId: user.id, username: user.username };
}
