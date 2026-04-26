const jwt = require('jsonwebtoken');
const config = require('../config');
const ApiError = require('../errors/ApiError');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'No token provided'));
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required'));
  }
  next();
}

module.exports = { authenticate, requireAdmin };
