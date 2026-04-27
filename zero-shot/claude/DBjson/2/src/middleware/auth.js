'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config');

/**
 * Strict authentication – rejects requests without a valid Bearer token.
 * Attaches the decoded payload as `req.user`.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header with Bearer token required' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, config.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication – sets `req.user` if a valid token is present,
 * but does not reject the request if absent.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), config.JWT_SECRET);
    } catch { /* ignore */ }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
