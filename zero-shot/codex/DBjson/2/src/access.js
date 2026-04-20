function ensureSharing(resource) {
  if (!resource.sharing || typeof resource.sharing !== "object") {
    resource.sharing = { users: {}, teams: {} };
  }
  if (!resource.sharing.users || typeof resource.sharing.users !== "object") {
    resource.sharing.users = {};
  }
  if (!resource.sharing.teams || typeof resource.sharing.teams !== "object") {
    resource.sharing.teams = {};
  }
  return resource.sharing;
}

function getUserTeamIds(data, userId) {
  return data._teams
    .filter((team) => team.ownerId === userId || team.members.includes(userId))
    .map((team) => team.id);
}

function getResourceAccess(resource, user, data) {
  if (!user) {
    return { canRead: false, canWrite: false, canDelete: false, canManageSharing: false };
  }

  if (user.role === "admin") {
    return { canRead: true, canWrite: true, canDelete: true, canManageSharing: true };
  }

  if (resource.ownerId === user.id) {
    return { canRead: true, canWrite: true, canDelete: true, canManageSharing: true };
  }

  const sharing = ensureSharing(resource);
  const userAccess = sharing.users[user.id];

  if (userAccess === "write") {
    return { canRead: true, canWrite: true, canDelete: false, canManageSharing: false };
  }

  if (userAccess === "read") {
    return { canRead: true, canWrite: false, canDelete: false, canManageSharing: false };
  }

  const teamIds = getUserTeamIds(data, user.id);
  for (const teamId of teamIds) {
    const teamAccess = sharing.teams[teamId];
    if (teamAccess === "write") {
      return { canRead: true, canWrite: true, canDelete: false, canManageSharing: false };
    }
    if (teamAccess === "read") {
      return { canRead: true, canWrite: false, canDelete: false, canManageSharing: false };
    }
  }

  return { canRead: false, canWrite: false, canDelete: false, canManageSharing: false };
}

function canAccessCollectionItem(resource, user, data, permission) {
  return getResourceAccess(resource, user, data)[permission];
}

module.exports = {
  canAccessCollectionItem,
  ensureSharing,
  getResourceAccess,
  getUserTeamIds,
};
