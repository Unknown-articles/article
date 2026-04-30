const crypto = require("crypto");

function newId() {
  return crypto.randomUUID();
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, password, ...safe } = user;
  return safe;
}

function sanitizeUsers(users) {
  return users.map(publicUser);
}

module.exports = { newId, publicUser, sanitizeUsers };
