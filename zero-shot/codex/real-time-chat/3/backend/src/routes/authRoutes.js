import { Router } from 'express';
import {
  comparePassword,
  createToken,
  createUser,
  findUserByUsername,
  hashPassword,
  validateCredentials,
} from '../auth.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const validation = validateCredentials(req.body?.username, req.body?.password);

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const existingUser = findUserByUsername(validation.username);

  if (existingUser) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const passwordHash = await hashPassword(validation.password);
  const user = createUser(validation.username, passwordHash);
  const token = createToken(user);

  return res.status(201).json({ token, userId: user.id, username: user.username });
});

authRouter.post('/login', async (req, res) => {
  const validation = validateCredentials(req.body?.username, req.body?.password);

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const user = findUserByUsername(validation.username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordMatches = await comparePassword(validation.password, user.password);

  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = createToken(user);

  return res.status(200).json({ token, userId: user.id, username: user.username });
});
