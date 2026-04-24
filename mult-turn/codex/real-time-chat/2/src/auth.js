import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';
const PASSWORD_SALT_ROUNDS = 12;

function createSessionToken(accountId, handle) {
  return jwt.sign({ userId: accountId, username: handle }, JWT_SECRET);
}

export function verifyAuthToken(token) {
  const parsedToken = jwt.verify(token, JWT_SECRET);

  return {
    userId: parsedToken.userId,
    username: parsedToken.username
  };
}

function validateRegistrationInput(username, password) {
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

function validateLoginInput(username, password) {
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
    db.run(sql, params, function onStatementComplete(error) {
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
  const [authScheme, token] = authHeader?.split(' ') ?? [];

  if (authScheme !== 'Bearer' || !token) {
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
  const authRouter = express.Router();

  authRouter.post('/register', async (req, res) => {
    const { username, password } = req.body ?? {};
    const validationError = validateRegistrationInput(username, password);

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
      const createdUserId = result.lastID;
      const token = createSessionToken(createdUserId, username);

      res.status(201).json({ token, userId: createdUserId, username });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }

      console.error('Failed to register user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  authRouter.post('/login', async (req, res) => {
    const { username, password } = req.body ?? {};
    const validationError = validateLoginInput(username, password);

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

      const token = createSessionToken(user.id, user.username);

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

  return authRouter;
}
