const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

function makeAuthMiddleware(db) {
  async function authenticate(req, res, next) {
    const authHeader = req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const data = await db.getData();
      const user = (data._users || []).find((entry) => entry.id === payload.id);
      if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      const { passwordHash, ...safeUser } = user;
      req.user = safeUser;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    next();
  }

  return { authenticate, requireAdmin };
}

module.exports = makeAuthMiddleware;
