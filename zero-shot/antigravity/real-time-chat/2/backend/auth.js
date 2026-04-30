import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from './db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username already taken' });
          }
          return res.status(500).json({ error: 'Database error' });
        }

        const userId = this.lastID;
        const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '24h' });
        
        res.status(201).json({ token, userId, username });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(200).json({ token, userId: user.id, username: user.username });
  });
});

export default router;
