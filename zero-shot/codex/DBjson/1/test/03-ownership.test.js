const assert = require("node:assert/strict");
const { test } = require("./harness");
const { bearer, createResource, withContext } = require("./helpers");

test("Admin can GET single item owned by another user", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "docs", { name: "One" });
    const response = await api.get(`/docs/${created.body.id}`).set(bearer(users.adminToken));
    assert.equal(response.status, 200);
  });
});

test("Admin can PATCH item owned by another user", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "docs", { name: "One" });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ name: "Two" });
    assert.equal(response.status, 200);
  });
});

test("Admin can DELETE item owned by another user", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "docs", { name: "One" });
    const response = await api.delete(`/docs/${created.body.id}`).set(bearer(users.adminToken));
    assert.equal(response.status, 204);
  });
});

test("User cannot GET item owned by another user (no sharing)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "One" });
    const response = await api.get(`/docs/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 403);
  });
});

test("User cannot PUT item owned by another user", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "One" });
    const response = await api.put(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ name: "Two" });
    assert.equal(response.status, 403);
  });
});

test("User cannot PATCH item owned by another user", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "One" });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ name: "Two" });
    assert.equal(response.status, 403);
  });
});

test("User cannot DELETE item owned by another user", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "One" });
    const response = await api.delete(`/docs/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 403);
  });
});

test("User can GET their own resource", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "docs", { name: "One" });
    const response = await api.get(`/docs/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 200);
  });
});

test("User can PATCH their own resource", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "docs", { name: "One" });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ name: "Two" });
    assert.equal(response.status, 200);
  });
});

test("User can PUT their own resource", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "docs", { name: "One" });
    const response = await api.put(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ title: "Two" });
    assert.equal(response.status, 200);
  });
});

test("GET list – user only sees own items (no sharing)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await createResource(api, users.userToken, "docs", { name: "Mine" });
    await createResource(api, users.adminToken, "docs", { name: "Admin" });
    const response = await api.get("/docs").set(bearer(users.userToken));
    assert.equal(response.body.length, 1);
  });
});

test("GET list – admin sees all items", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await createResource(api, users.userToken, "docs", { name: "Mine" });
    await createResource(api, users.adminToken, "docs", { name: "Admin" });
    const response = await api.get("/docs").set(bearer(users.adminToken));
    assert.equal(response.body.length, 2);
  });
});

test("Every created resource has ownerId equal to creator", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await createResource(api, users.userToken, "docs", { name: "Mine" });
    assert.equal(response.body.ownerId, users.user.id);
  });
});

test("Owner can modify their own resource", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "docs", { name: "Mine" });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ name: "Updated" });
    assert.equal(response.body.name, "Updated");
  });
});

test("Non-owner user cannot modify another user's resource", async () => {
  await withContext(async ({ api, register, login }) => {
    await register("owner", "secret");
    await register("other", "secret");
    const ownerLogin = await login("owner", "secret");
    const otherLogin = await login("other", "secret");
    const created = await createResource(api, ownerLogin.body.token, "docs", { name: "Mine" });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(otherLogin.body.token)).send({ name: "Nope" });
    assert.equal(response.status, 403);
  });
});

test("Only owner or admin can delete – shared-write user cannot delete", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "write" }, teams: {} } });
    const response = await api.delete(`/docs/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 403);
  });
});

test("System fields (id, ownerId, createdAt) cannot be overwritten by client", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    const response = await api
      .patch(`/docs/${created.body.id}`)
      .set(bearer(users.adminToken))
      .send({ id: "hack", ownerId: "hack", createdAt: "hack", name: "Updated" });
    assert.equal(response.body.id, created.body.id);
    assert.equal(response.body.ownerId, users.admin.id);
    assert.notEqual(response.body.createdAt, "hack");
  });
});
