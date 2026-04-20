const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'supersecretjwtkey';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({error: 'Authentication required'});
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({error: 'Invalid token'});
  }
}

function authorizeRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({error: 'Authentication required'});
    }
    if (req.user.role !== requiredRole) {
      return res.status(403).json({error: 'Forbidden'});
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorizeRole,
  jwtSecret: secret
};
