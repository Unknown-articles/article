const RESERVED_COLLECTIONS = new Set(["auth", "_users", "_teams", "_meta"]);
const USER_ROLES = new Set(["admin", "user"]);
const SHARE_ACCESS = new Set(["read", "write"]);
const SYSTEM_FIELDS = new Set(["id", "ownerId", "createdAt"]);

module.exports = {
  RESERVED_COLLECTIONS,
  SHARE_ACCESS,
  SYSTEM_FIELDS,
  USER_ROLES,
};
