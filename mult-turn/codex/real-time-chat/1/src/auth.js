import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';
const PASSWORD_SALT_ROUNDS = 12;

function signAuthToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET);
}

export function verifyAuthToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);

  return {
    userId: decoded.userId,
    username: decoded.username
  };
}

function validateRegistration(username, password) {
  if (!username) {
    return 'Username is required';
  }

  if (username.length < 3) {
    return 'Username must be at least 3 characters';
  }

  if (!password) {
    return 'Password is required';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }

  return null;
}

function validateLogin(username, password) {
  if (!username) {
    return 'Username is required';
  }

  if (!password) {
    return 'Password is required';
  }

  return null;
}

function run(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function handleRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function isUniqueConstraintError(error) {
  return error?.code === 'SQLITE_CONSTRAINT' && error.message.includes('users.username');
}

export function authenticateToken(req, res, next) {
  const authHeader = req.get('Authorization');
  const [scheme, token] = authHeader?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function createAuthRouter({ express, db }) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const { username, password } = req.body ?? {};
    const validationError = validateRegistration(username, password);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
      const result = await run(
        db,
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword]
      );
      const userId = result.lastID;
      const token = signAuthToken(userId, username);

      res.status(201).json({ token, userId, username });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }

      console.error('Failed to register user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body ?? {};
    const validationError = validateLogin(username, password);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    try {
      const user = await get(
        db,
        'SELECT id, username, password FROM users WHERE username = ?',
        [username]
      );

      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const passwordMatches = await bcrypt.compare(password, user.password);

      if (!passwordMatches) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = signAuthToken(user.id, user.username);

      res.status(200).json({
        token,
        userId: user.id,
        username: user.username
      });
    } catch (error) {
      console.error('Failed to log in user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
