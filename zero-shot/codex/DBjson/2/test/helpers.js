const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");
const { createApp } = require("../src/app");

async function createTestContext() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dynamic-json-api-"));
  const dataFile = path.join(directory, "db.json");
  const app = createApp({ dataFile, jwtSecret: "test-secret" });
  await app.locals.ready;

  const api = request(app);

  async function register(username, password) {
    return api.post("/auth/register").send({ username, password });
  }

  async function login(username, password) {
    return api.post("/auth/login").send({ username, password });
  }

  async function seedUsers() {
    const admin = await register("admin", "secret");
    const user = await register("user", "secret");
    const adminLogin = await login("admin", "secret");
    const userLogin = await login("user", "secret");

    return {
      admin: admin.body,
      user: user.body,
      adminToken: adminLogin.body.token,
      userToken: userLogin.body.token,
    };
  }

  async function cleanup() {
    await fs.rm(directory, { recursive: true, force: true });
  }

  return {
    api,
    cleanup,
    dataFile,
    login,
    register,
    seedUsers,
  };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

async function withContext(fn) {
  const context = await createTestContext();
  try {
    await fn(context);
  } finally {
    await context.cleanup();
  }
}

async function createResource(api, token, resource, body) {
  return api.post(`/${resource}`).set(bearer(token)).send(body);
}

module.exports = {
  bearer,
  createResource,
  createTestContext,
  withContext,
};
