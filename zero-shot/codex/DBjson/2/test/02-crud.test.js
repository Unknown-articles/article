const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { test } = require("./harness");
const { bearer, createResource, withContext } = require("./helpers");

test("POST /:resource – creates new collection and resource", async () => {
  await withContext(async ({ api, seedUsers, dataFile }) => {
    const users = await seedUsers();
    const response = await createResource(api, users.adminToken, "products", { name: "Book" });
    assert.equal(response.status, 201);
    const raw = JSON.parse(await fs.readFile(dataFile, "utf8"));
    assert.equal(raw.products.length, 1);
  });
});

test("POST /:resource – any arbitrary JSON payload is accepted", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const payload = { name: "Book", price: 10, details: { color: "red" }, tags: ["a", "b"] };
    const response = await createResource(api, users.adminToken, "products", payload);
    assert.equal(response.status, 201);
    assert.equal(response.body.details.color, "red");
    assert.deepEqual(response.body.tags, ["a", "b"]);
  });
});

test("POST /:resource – client-supplied id is ignored (system generates one)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await createResource(api, users.adminToken, "products", { id: "manual", name: "Book" });
    assert.notEqual(response.body.id, "manual");
  });
});

test("POST /:resource – client-supplied ownerId is ignored", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await createResource(api, users.adminToken, "products", { ownerId: "manual", name: "Book" });
    assert.equal(response.body.ownerId, users.admin.id);
  });
});

test("GET /:resource – lists resources (admin sees all)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await createResource(api, users.adminToken, "products", { name: "One" });
    await createResource(api, users.userToken, "products", { name: "Two" });
    const response = await api.get("/products").set(bearer(users.adminToken));
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 2);
  });
});

test("GET /:resource – returns 401 without token", async () => {
  await withContext(async ({ api }) => {
    const response = await api.get("/products");
    assert.equal(response.status, 401);
  });
});

test("GET /:resource/:id – retrieves a single item", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "products", { name: "One" });
    const response = await api.get(`/products/${created.body.id}`).set(bearer(users.adminToken));
    assert.equal(response.status, 200);
    assert.equal(response.body.id, created.body.id);
  });
});

test("GET /:resource/:id – returns 404 for unknown id", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.get("/products/missing").set(bearer(users.adminToken));
    assert.equal(response.status, 404);
  });
});

test("PUT /:resource/:id – fully replaces resource fields", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "products", { name: "One", price: 1 });
    const response = await api.put(`/products/${created.body.id}`).set(bearer(users.adminToken)).send({ title: "Replaced" });
    assert.equal(response.status, 200);
    assert.equal(response.body.title, "Replaced");
    assert.equal(response.body.name, undefined);
  });
});

test("PUT /:resource/:id – returns 404 for unknown id", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.put("/products/missing").set(bearer(users.adminToken)).send({ title: "Nope" });
    assert.equal(response.status, 404);
  });
});

test("PATCH /:resource/:id – updates only supplied fields", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "products", { name: "One", price: 1 });
    const response = await api.patch(`/products/${created.body.id}`).set(bearer(users.adminToken)).send({ price: 2 });
    assert.equal(response.status, 200);
    assert.equal(response.body.name, "One");
    assert.equal(response.body.price, 2);
  });
});

test("PATCH /:resource/:id – returns 404 for unknown id", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.patch("/products/missing").set(bearer(users.adminToken)).send({ price: 2 });
    assert.equal(response.status, 404);
  });
});

test("DELETE /:resource/:id – owner can delete own resource", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "products", { name: "One" });
    const response = await api.delete(`/products/${created.body.id}`).set(bearer(users.userToken));
    assert.equal(response.status, 204);
  });
});

test("DELETE /:resource/:id – admin can delete any resource", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.userToken, "products", { name: "One" });
    const response = await api.delete(`/products/${created.body.id}`).set(bearer(users.adminToken));
    assert.equal(response.status, 204);
  });
});

test("DELETE /:resource/:id – returns 404 for unknown id", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.delete("/products/missing").set(bearer(users.adminToken));
    assert.equal(response.status, 404);
  });
});

test('Reserved collection "_users" is rejected', async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.post("/_users").set(bearer(users.adminToken)).send({ name: "x" });
    assert.equal(response.status, 400);
  });
});

test('Reserved collection "auth" is rejected by dynamic router', async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const response = await api.post("/auth").set(bearer(users.adminToken)).send({ name: "x" });
    assert.equal(response.status, 404);
  });
});
