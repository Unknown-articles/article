const { randomUUID } = require("node:crypto");

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeCollectionName(name) {
  return String(name || "").trim();
}

function createId() {
  return randomUUID();
}

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function parseValue(raw) {
  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  if (raw === "null") {
    return null;
  }

  if (raw !== "" && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }

  return raw;
}

module.exports = {
  clone,
  createId,
  normalizeCollectionName,
  nowIso,
  parseValue,
  sanitizeUser,
};
