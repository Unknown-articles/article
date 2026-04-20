const crypto = require("crypto");
const { HttpError } = require("../errors");
const { applyListQuery } = require("./queryService");

function toStoredRecord(payload, existingRecord) {
  const now = new Date().toISOString();
  const baseRecord = existingRecord || {
    id: crypto.randomUUID(),
    ownerId: null,
    sharedWith: {
      users: [],
      teams: [],
    },
    createdAt: now,
  };

  return {
    ...baseRecord,
    data: payload,
    updatedAt: now,
  };
}

class DataService {
  constructor(store) {
    this.store = store;
  }

  async list(resourceName, actor, query = {}) {
    this.assertResourceAllowed(resourceName);

    const database = await this.store.read();
    const collection = this.getCollection(database, resourceName);
    const visible = collection.filter((record) => canRead(record, actor));
    return applyListQuery(visible, query);
  }

  async get(resourceName, id, actor) {
    this.assertResourceAllowed(resourceName);

    const database = await this.store.read();
    const collection = this.getCollection(database, resourceName);
    const record = collection.find((item) => item.id === id);

    if (!record) {
      throw new HttpError(404, `Resource ${resourceName}/${id} not found`);
    }

    if (!canRead(record, actor)) {
      throw new HttpError(403, "You do not have access to this resource");
    }

    return record;
  }

  async create(resourceName, payload, actor) {
    this.assertResourceAllowed(resourceName);

    if (!actor) {
      throw new HttpError(401, "Authentication required");
    }

    return this.store.update(async (database) => {
      const collection = this.getCollection(database, resourceName);
      const record = toStoredRecord(payload);
      record.ownerId = actor.id;
      collection.push(record);
      return record;
    });
  }

  async replace(resourceName, id, payload, actor) {
    return this.updateRecord(resourceName, id, payload, actor, { merge: false });
  }

  async patch(resourceName, id, payload, actor) {
    return this.updateRecord(resourceName, id, payload, actor, { merge: true });
  }

  async remove(resourceName, id, actor) {
    this.assertResourceAllowed(resourceName);

    return this.store.update(async (database) => {
      const collection = this.getCollection(database, resourceName);
      const index = collection.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new HttpError(404, `Resource ${resourceName}/${id} not found`);
      }

      const record = collection[index];

      if (!canDelete(record, actor)) {
        throw new HttpError(403, "Only the owner or an admin can delete this resource");
      }

      const [deleted] = collection.splice(index, 1);
      return deleted;
    });
  }

  async share(resourceName, id, payload, actor) {
    this.assertResourceAllowed(resourceName);

    return this.store.update(async (database) => {
      const collection = this.getCollection(database, resourceName);
      const index = collection.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new HttpError(404, `Resource ${resourceName}/${id} not found`);
      }

      const current = collection[index];

      if (!canShare(current, actor)) {
        throw new HttpError(403, "Only the owner or an admin can share this resource");
      }

      current.sharedWith = {
        users: normalizeShares(payload.users, "userId"),
        teams: normalizeShares(payload.teams, "teamId"),
      };
      current.updatedAt = new Date().toISOString();
      collection[index] = current;

      return current;
    });
  }

  getCollection(database, resourceName) {
    if (!database[resourceName]) {
      database[resourceName] = [];
    }

    if (!Array.isArray(database[resourceName])) {
      throw new HttpError(400, `${resourceName} is not a collection`);
    }

    return database[resourceName];
  }

  async updateRecord(resourceName, id, payload, actor, { merge }) {
    this.assertResourceAllowed(resourceName);

    return this.store.update(async (database) => {
      const collection = this.getCollection(database, resourceName);
      const index = collection.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new HttpError(404, `Resource ${resourceName}/${id} not found`);
      }

      const current = collection[index];

      if (!canWrite(current, actor)) {
        throw new HttpError(403, "You do not have permission to modify this resource");
      }

      const currentData = current.data;
      const nextPayload =
        merge && isPlainObject(currentData) && isPlainObject(payload)
          ? { ...currentData, ...payload }
          : payload;

      const updated = toStoredRecord(nextPayload, current);
      collection[index] = updated;
      return updated;
    });
  }

  assertResourceAllowed(resourceName) {
    if (resourceName.startsWith("_") || resourceName === "auth") {
      throw new HttpError(404, "Route not found");
    }
  }
}

function normalizeShares(entries = [], idKey) {
  if (!Array.isArray(entries)) {
    throw new HttpError(400, `${idKey} shares must be an array`);
  }

  return entries.map((entry) => {
    if (!entry || typeof entry !== "object" || !entry[idKey]) {
      throw new HttpError(400, `Each share must include ${idKey}`);
    }

    const access = entry.access || "read";

    if (!["read", "write"].includes(access)) {
      throw new HttpError(400, "Share access must be read or write");
    }

    return {
      [idKey]: entry[idKey],
      access,
    };
  });
}

function canRead(record, actor) {
  return getAccessLevel(record, actor) !== null;
}

function canWrite(record, actor) {
  const access = getAccessLevel(record, actor);
  return access === "owner" || access === "admin" || access === "write";
}

function canDelete(record, actor) {
  const access = getAccessLevel(record, actor);
  return access === "owner" || access === "admin";
}

function canShare(record, actor) {
  return canDelete(record, actor);
}

function getAccessLevel(record, actor) {
  if (!actor) {
    return null;
  }

  if (actor.role === "admin") {
    return "admin";
  }

  if (record.ownerId === actor.id) {
    return "owner";
  }

  const userShare = (record.sharedWith?.users || []).find((entry) => entry.userId === actor.id);

  if (userShare) {
    return userShare.access;
  }

  const teamIds = actor.teamIds || [];
  const teamShare = (record.sharedWith?.teams || []).find((entry) => teamIds.includes(entry.teamId));

  if (teamShare) {
    return teamShare.access;
  }

  return null;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

module.exports = {
  DataService,
};
