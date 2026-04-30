import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserById, findUserByUsername } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'development-chat-secret';
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim() : '';
}

function validateCredentials(username, password) {
  if (!username || username.length < 3) {
    return 'Username must be at least 3 characters';
  }

  if (typeof password !== 'string' || password.length < 6) {
    return 'Password must be at least 6 characters';
  }

  return null;
}

export function signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN },
  );
}

export function verifyToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  const userId = Number(payload.userId);

  if (!Number.isInteger(userId)) {
    throw new Error('Invalid token');
  }

  const user = findUserById(userId);

  if (!user || user.username !== payload.username) {
    throw new Error('Invalid token');
  }

  return user;
}

export function register(req, res) {
  const username = normalizeUsername(req.body?.username);
  const { password } = req.body || {};
  const validationMessage = validateCredentials(username, password);

  if (validationMessage) {
    return res.status(400).json({ error: validationMessage });
  }

  const existingUser = findUserByUsername(username);

  if (existingUser) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const user = createUser(username, passwordHash);

  return res.status(201).json({
    token: signToken(user),
    userId: user.id,
    username: user.username,
  });
}

export function login(req, res) {
  const username = normalizeUsername(req.body?.username);
  const { password } = req.body || {};

  if (!username || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = findUserByUsername(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.status(200).json({
    token: signToken(user),
    userId: user.id,
    username: user.username,
  });
}
