import express from 'express';
import { register, login } from '../auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await register(username, password);
    res.status(201).json(result);
  } catch (err) {
    if (err.message === 'Username already taken') {
      res.status(409).json({ error: err.message });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await login(username, password);
    res.status(200).json(result);
  } catch (err) {
    if (err.message === 'Invalid credentials') {
      res.status(401).json({ error: err.message });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;