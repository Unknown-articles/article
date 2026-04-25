import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = Router();
const BCRYPT_ROUNDS = 12;

router.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (!password) return res.status(400).json({ error: 'Password is required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const hashedPwd = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let account;
  try {
    account = db.prepare(
      'INSERT INTO users (username, password) VALUES (?, ?) RETURNING id, username'
    ).get(username, hashedPwd);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    throw err;
  }

  const token = jwt.sign(
    { userId: account.id, username: account.username },
    process.env.JWT_SECRET ?? 'dev-secret',
    { expiresIn: '7d' }
  );

  res.status(201).json({ token, userId: account.id, username: account.username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (!password) return res.status(400).json({ error: 'Password is required' });

  const account = db.prepare('SELECT id, username, password FROM users WHERE username = ?').get(username);

  const isValid = account && await bcrypt.compare(password, account.password);
  if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: account.id, username: account.username },
    process.env.JWT_SECRET ?? 'dev-secret',
    { expiresIn: '7d' }
  );

  res.json({ token, userId: account.id, username: account.username });
});

export default router;
