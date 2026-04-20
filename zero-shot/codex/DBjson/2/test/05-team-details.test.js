const assert = require("node:assert/strict");
const { test } = require("./harness");
const { bearer, createResource, withContext } = require("./helpers");

test("GET /auth/teams/:id – member can view team details", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.adminToken)).send({ name: "Team A" });
    await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.user.id });
    const response = await api.get(`/auth/teams/${team.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 200);
  });
});

test("DELETE /auth/teams/:id/members/:userId – owner can remove member", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.adminToken)).send({ name: "Team A" });
    await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.user.id });
    const response = await api.delete(`/auth/teams/${team.body.id}/members/${users.user.id}`).set(bearer(users.adminToken));
    assert.equal(response.status, 200);
    assert.equal(response.body.members.includes(users.user.id), false);
  });
});

test("After removal team doc is no longer accessible", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.adminToken)).send({ name: "Team A" });
    await api.post(`/auth/teams/${team.body.id}/members`).set(bearer(users.adminToken)).send({ userId: users.user.id });
    const created = await createResource(api, users.adminToken, "docs", { name: "Mine" });
    await api.patch(`/docs/${created.body.id}`).set(bearer(users.adminToken)).send({ sharing: { users: {}, teams: { [team.body.id]: "read" } } });
    await api.delete(`/auth/teams/${team.body.id}/members/${users.user.id}`).set(bearer(users.adminToken));
    const response = await api.get(`/docs/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 403);
  });
});

test("PATCH /auth/teams/:id – owner can rename team", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.userToken)).send({ name: "Team A" });
    const response = await api.patch(`/auth/teams/${team.body.id}`).set(bearer(users.userToken)).send({ name: "Team B" });
    assert.equal(response.status, 200);
    assert.equal(response.body.name, "Team B");
  });
});

test("DELETE /auth/teams/:id – owner can delete team", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const team = await api.post("/auth/teams").set(bearer(users.userToken)).send({ name: "Team A" });
    const response = await api.delete(`/auth/teams/${team.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 204);
  });
});
