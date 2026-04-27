const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const { HttpError } = require("../errors");

class AuthService {
  constructor(store) {
    this.store = store;
  }

  async register({ username, password, role = "user" }) {
    if (!username || !password) {
      throw new HttpError(400, "username and password are required");
    }

    if (!["admin", "user"].includes(role)) {
      throw new HttpError(400, "role must be admin or user");
    }

    return this.store.update(async (database) => {
      const users = database._auth.users;
      const existing = users.find((user) => user.username === username);

      if (existing) {
        throw new HttpError(409, "username already exists");
      }

      const now = new Date().toISOString();
      const user = {
        id: crypto.randomUUID(),
        username,
        role,
        teamIds: [],
        passwordHash: await bcrypt.hash(password, 10),
        createdAt: now,
        updatedAt: now,
      };

      users.push(user);
      return this.buildAuthResponse(user);
    });
  }

  async login({ username, password }) {
    if (!username || !password) {
      throw new HttpError(400, "username and password are required");
    }

    const database = await this.store.read();
    const user = database._auth.users.find((item) => item.username === username);

    if (!user) {
      throw new HttpError(401, "Invalid credentials");
    }

    const matches = await bcrypt.compare(password, user.passwordHash);

    if (!matches) {
      throw new HttpError(401, "Invalid credentials");
    }

    return this.buildAuthResponse(user);
  }

  async getUserById(id) {
    const database = await this.store.read();
    const user = database._auth.users.find((item) => item.id === id);

    if (!user) {
      throw new HttpError(401, "User session is no longer valid");
    }

    return this.sanitizeUser(user);
  }

  async listTeams(user) {
    const database = await this.store.read();
    return (database._auth.teams || []).filter((team) => team.memberIds.includes(user.id));
  }

  async createTeam(user, { name }) {
    if (!name) {
      throw new HttpError(400, "team name is required");
    }

    return this.store.update(async (database) => {
      if (!Array.isArray(database._auth.teams)) {
        database._auth.teams = [];
      }

      const now = new Date().toISOString();
      const team = {
        id: crypto.randomUUID(),
        name,
        ownerId: user.id,
        memberIds: [user.id],
        createdAt: now,
        updatedAt: now,
      };

      database._auth.teams.push(team);

      const targetUser = database._auth.users.find((item) => item.id === user.id);
      targetUser.teamIds = Array.from(new Set([...(targetUser.teamIds || []), team.id]));
      targetUser.updatedAt = now;

      return team;
    });
  }

  async addTeamMember(user, teamId, { userId }) {
    if (!userId) {
      throw new HttpError(400, "userId is required");
    }

    return this.store.update(async (database) => {
      const teams = database._auth.teams || [];
      const team = teams.find((item) => item.id === teamId);

      if (!team) {
        throw new HttpError(404, `Team ${teamId} not found`);
      }

      if (team.ownerId !== user.id && user.role !== "admin") {
        throw new HttpError(403, "Only the team owner or an admin can add members");
      }

      const member = database._auth.users.find((item) => item.id === userId);

      if (!member) {
        throw new HttpError(404, `User ${userId} not found`);
      }

      team.memberIds = Array.from(new Set([...(team.memberIds || []), userId]));
      team.updatedAt = new Date().toISOString();
      member.teamIds = Array.from(new Set([...(member.teamIds || []), teamId]));
      member.updatedAt = team.updatedAt;

      return team;
    });
  }

  buildAuthResponse(user) {
    return {
      token: jwt.sign(
        {
          sub: user.id,
          username: user.username,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: "1h" },
      ),
      user: this.sanitizeUser(user),
    };
  }

  sanitizeUser(user) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      teamIds: user.teamIds || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

module.exports = {
  AuthService,
};
