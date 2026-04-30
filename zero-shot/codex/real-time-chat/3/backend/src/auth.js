import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';
import { db } from './db.js';

const TOKEN_EXPIRES_IN = '7d';

export function validateCredentials(username, password) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedPassword = typeof password === 'string' ? password : '';

  if (normalizedUsername.length < 3) {
    return { error: 'Username must be at least 3 characters' };
  }

  if (normalizedPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  return { username: normalizedUsername, password: normalizedPassword };
}

export function createToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function findUserByUsername(username) {
  return db.prepare('SELECT id, username, password, created_at FROM users WHERE username = ?').get(username);
}

export function findUserById(userId) {
  return db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(userId);
}

export function createUser(username, passwordHash) {
  return db
    .prepare('INSERT INTO users (username, password) VALUES (?, ?) RETURNING id, username')
    .get(username, passwordHash);
}
