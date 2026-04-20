const assert = require("node:assert/strict");
const { test } = require("./harness");
const { bearer, withContext } = require("./helpers");

test("GET /health returns 200 with status ok", async () => {
  await withContext(async ({ api }) => {
    const response = await api.get("/health");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: "ok" });
  });
});

test("POST /auth/register – first user becomes admin", async () => {
  await withContext(async ({ register }) => {
    const response = await register("admin", "secret");
    assert.equal(response.status, 201);
    assert.equal(response.body.role, "admin");
  });
});

test("POST /auth/register – second user gets user role", async () => {
  await withContext(async ({ register }) => {
    await register("admin", "secret");
    const response = await register("user", "secret");
    assert.equal(response.body.role, "user");
  });
});

test("POST /auth/register – rejects duplicate username", async () => {
  await withContext(async ({ register }) => {
    await register("admin", "secret");
    const response = await register("admin", "secret");
    assert.equal(response.status, 409);
  });
});

test("POST /auth/register – rejects missing fields", async () => {
  await withContext(async ({ api }) => {
    const response = await api.post("/auth/register").send({ username: "admin" });
    assert.equal(response.status, 400);
  });
});

test("POST /auth/login – admin can login and receives JWT", async () => {
  await withContext(async ({ register, login }) => {
    await register("admin", "secret");
    const response = await login("admin", "secret");
    assert.equal(response.status, 200);
    assert.ok(response.body.token);
  });
});

test("POST /auth/login – regular user can login and receives JWT", async () => {
  await withContext(async ({ register, login }) => {
    await register("admin", "secret");
    await register("user", "secret");
    const response = await login("user", "secret");
    assert.equal(response.status, 200);
    assert.ok(response.body.token);
  });
});

test("POST /auth/login – wrong password returns 401", async () => {
  await withContext(async ({ register, login }) => {
    await register("admin", "secret");
    const response = await login("admin", "wrong");
    assert.equal(response.status, 401);
  });
});

test("POST /auth/login – unknown username returns 401", async () => {
  await withContext(async ({ login }) => {
    const response = await login("missing", "secret");
    assert.equal(response.status, 401);
  });
});

test("GET /auth/me – returns caller profile", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.get("/auth/me").set(bearer(users.adminToken));
    assert.equal(response.status, 200);
    assert.equal(response.body.username, "admin");
  });
});

test("GET /auth/me – rejects unauthenticated request", async () => {
  await withContext(async ({ api }) => {
    const response = await api.get("/auth/me");
    assert.equal(response.status, 401);
  });
});

test("GET /auth/users – admin can list all users", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.get("/auth/users").set(bearer(users.adminToken));
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 2);
  });
});

test("GET /auth/users – regular user is forbidden", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.get("/auth/users").set(bearer(users.userToken));
    assert.equal(response.status, 403);
  });
});

test("PATCH /auth/users/:id/role – admin can promote user to admin", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api
      .patch(`/auth/users/${users.user.id}/role`)
      .set(bearer(users.adminToken))
      .send({ role: "admin" });
    assert.equal(response.status, 200);
    assert.equal(response.body.role, "admin");
  });
});

test("PATCH /auth/users/:id/role – admin can demote back to user", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await api.patch(`/auth/users/${users.user.id}/role`).set(bearer(users.adminToken)).send({ role: "admin" });
    const response = await api
      .patch(`/auth/users/${users.user.id}/role`)
      .set(bearer(users.adminToken))
      .send({ role: "user" });
    assert.equal(response.status, 200);
    assert.equal(response.body.role, "user");
  });
});

test("PATCH /auth/users/:id/role – invalid role is rejected", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api
      .patch(`/auth/users/${users.user.id}/role`)
      .set(bearer(users.adminToken))
      .send({ role: "owner" });
    assert.equal(response.status, 400);
  });
});

test("PATCH /auth/users/:id/role – non-admin is forbidden", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api
      .patch(`/auth/users/${users.admin.id}/role`)
      .set(bearer(users.userToken))
      .send({ role: "user" });
    assert.equal(response.status, 403);
  });
});
