const jwt = require('jsonwebtoken');
const { readDB } = require('../utils/fileOps');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

async function authorize(req, res, next) {
  const { resource, id } = req.params;
  const db = await readDB();
  const collection = db[resource];
  if (!collection) return next(); // If collection doesn't exist, allow creation

  if (req.method === 'GET' && !id) return next(); // Allow listing

  const item = id ? collection.find(i => i.id === id) : null;
  if (!item) return next(); // For POST or if not found

  if (item.ownerId === req.user.id || req.user.role === 'admin') {
    return next();
  }

  // Check shared access
  if (item.sharedWith && item.sharedWith.includes(req.user.id)) {
    return next();
  }

  return res.status(403).json({ error: 'Forbidden' });
}

module.exports = { authenticateToken, authorize };