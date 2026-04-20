import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { insertUser, getUserByUsername } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(user) {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export async function registerUser(username, password) {
  if (!username || username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const hashedPassword = hashPassword(password);
  try {
    const result = await insertUser(username, hashedPassword);
    const user = { id: result.lastID, username };
    return { token: generateToken(user), userId: user.id, username: user.username };
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Username already taken');
    }
    throw err;
  }
}

export async function loginUser(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const user = await getUserByUsername(username);
  if (!user || !verifyPassword(password, user.password)) {
    throw new Error('Invalid credentials');
  }

  return { token: generateToken(user), userId: user.id, username: user.username };
}