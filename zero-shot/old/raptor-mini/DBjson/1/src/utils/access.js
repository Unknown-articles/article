function isAdmin(user) {
  return user && user.role === 'admin';
}

function isOwner(user, item) {
  return item && user && item.ownerId === user.id;
}

function normalizeSharedWith(sharedWith) {
  if (!Array.isArray(sharedWith)) return [];
  return sharedWith
    .filter((entry) => entry && entry.type && entry.id && entry.access)
    .map((entry) => ({
      type: entry.type === 'team' ? 'team' : 'user',
      id: String(entry.id),
      access: entry.access === 'write' ? 'write' : 'read'
    }));
}

function getAccessForUser(user, item, teams = []) {
  if (!user || !item) return null;
  if (isAdmin(user) || isOwner(user, item)) {
    return 'write';
  }

  const entries = Array.isArray(item.sharedWith) ? item.sharedWith : [];
  const direct = entries.find((entry) => entry.type === 'user' && entry.id === user.id);
  if (direct) return direct.access;

  const userTeams = teams.filter((team) => Array.isArray(team.members) && team.members.includes(user.id)).map((team) => team.id);
  const teamEntry = entries.find((entry) => entry.type === 'team' && userTeams.includes(entry.id));
  return teamEntry ? teamEntry.access : null;
}

function canRead(user, item, teams) {
  return Boolean(getAccessForUser(user, item, teams));
}

function canWrite(user, item, teams) {
  const access = getAccessForUser(user, item, teams);
  return access === 'write';
}

function canDelete(user, item) {
  return isAdmin(user) || isOwner(user, item);
}

function sanitizeResourcePayload(input, allowShared = false) {
  const output = {};
  if (typeof input !== 'object' || input === null) return output;

  for (const key of Object.keys(input)) {
    if (['id', 'ownerId', 'createdAt'].includes(key)) continue;
    if (key === 'sharedWith' && !allowShared) continue;
    output[key] = input[key];
  }

  return output;
}

module.exports = {
  isAdmin,
  isOwner,
  normalizeSharedWith,
  getAccessForUser,
  canRead,
  canWrite,
  canDelete,
  sanitizeResourcePayload
};
