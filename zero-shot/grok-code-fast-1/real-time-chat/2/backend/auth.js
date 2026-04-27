import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { initDB } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function register(username, password) {
  if (!username || username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const db = await initDB();
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', [result.lastID]);
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
    return { token, userId: user.id, username: user.username };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      throw new Error('Username already taken');
    }
    throw err;
  }
}

export async function login(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const db = await initDB();
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);
  return { token, userId: user.id, username: user.username };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}