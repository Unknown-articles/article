/**
 * Returns the effective access level a user has on an item.
 * Possible values: 'owner' | 'write' | 'read' | null
 */
function getAccess(item, userId, userTeamIds = []) {
  if (item.ownerId === userId) return 'owner';

  // Per-user sharing
  if (Array.isArray(item.sharedWith)) {
    const entry = item.sharedWith.find(s => s.userId === userId);
    if (entry) return entry.access; // 'read' or 'write'
  }

  // Team sharing — 'write' beats 'read'
  if (Array.isArray(item.sharedWithTeams)) {
    let best = null;
    for (const ts of item.sharedWithTeams) {
      if (userTeamIds.includes(ts.teamId)) {
        if (ts.access === 'write') return 'write';
        best = 'read';
      }
    }
    if (best) return best;
  }

  return null;
}

/** True when the user can see the item at all. */
function canRead(item, userId, userTeamIds) {
  return getAccess(item, userId, userTeamIds) !== null;
}

/** True when the user can mutate (PUT/PATCH) the item. */
function canWrite(item, userId, userTeamIds) {
  const a = getAccess(item, userId, userTeamIds);
  return a === 'owner' || a === 'write';
}

/** Only the owner can delete. */
function canDelete(item, userId) {
  return item.ownerId === userId;
}

module.exports = { getAccess, canRead, canWrite, canDelete };
