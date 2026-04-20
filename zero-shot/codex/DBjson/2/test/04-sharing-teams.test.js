const assert = require("node:assert/strict");
const { test } = require("./harness");
const { bearer, createResource, withContext } = require("./helpers");

test("Owner can share resource with another user (read access)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "read" }, teams: {} } });
    assert.equal(response.body.sharing.users[users.user.id], "read");
  });
});

test("User with read access can GET the shared item", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "read" }, teams: {} } });
    const response = await api.get(`/docs/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 200);
  });
});

test("Shared item appears in list for the grantee", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "read" }, teams: {} } });
    const response = await api.get("/docs").set(bearer(users.userToken));
    assert.equal(response.body.some((item) => item.id === created.body.id), true);
  });
});

test("User with read-only access cannot PATCH the shared item", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "read" }, teams: {} } });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ name: "Nope" });
    assert.equal(response.status, 403);
  });
});

test("Owner can share resource with write access", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "write" }, teams: {} } });
    assert.equal(response.body.sharing.users[users.user.id], "write");
  });
});

test("User with write access can PATCH the shared item", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "write" }, teams: {} } });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ name: "Updated" });
    assert.equal(response.status, 200);
  });
});

test("User with write access can PUT the shared item", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "write" }, teams: {} } });
    const response = await api.put(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ title: "Updated" });
    assert.equal(response.status, 200);
  });
});

test("User with write access cannot DELETE the shared item (owner-only)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "write" }, teams: {} } });
    const response = await api.delete(`/docs/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 403);
  });
});

test("Owner can update sharing config via PATCH", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "read" }, teams: {} } });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: { [users.user.id]: "write" }, teams: {} } });
    assert.equal(response.body.sharing.users[users.user.id], "write");
  });
});

test("POST /auth/teams – owner can create a team", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.post("/auth/teams").set(bearer(users.userToken)).send({ name: "Team A" });
    assert.equal(response.status, 201);
  });
});

test("POST /auth/teams/:id/members – admin can add user to team", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.userToken)).send({ name: "Team A" });
    const response = await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.admin.id });
    assert.equal(response.status, 200);
  });
});

test("Resource shared with team is visible to team member", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.adminToken)).send({ name: "Team A" });
    await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.user.id });
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: {}, teams: { [team.body.id]: "read" } } });
    const response = await api.get(`/docs/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 200);
  });
});

test("Team doc appears in list for team member", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.adminToken)).send({ name: "Team A" });
    await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.user.id });
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: {}, teams: { [team.body.id]: "read" } } });
    const response = await api.get("/docs").set(bearer(users.userToken));
    assert.equal(response.body.some((item) => item.id === created.body.id), true);
  });
});

test("Team member with read access cannot PATCH team-shared item", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.adminToken)).send({ name: "Team A" });
    await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.user.id });
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: {}, teams: { [team.body.id]: "read" } } });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ name: "Nope" });
    assert.equal(response.status, 403);
  });
});

test("Team member with write access can PATCH team-shared item", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.adminToken)).send({ name: "Team A" });
    await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.user.id });
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: {}, teams: { [team.body.id]: "write" } } });
    const response = await api.patch(`/docs/${created.body.id}`).set(bearer(users.userToken)).send({ name: "Updated" });
    assert.equal(response.status, 200);
  });
});

test("GET /auth/teams – member can list their teams", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.adminToken)).send({ name: "Team A" });
    await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.user.id });
    const response = await api.get("/auth/teams").set(bearer(users.userToken));
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
  });
});
