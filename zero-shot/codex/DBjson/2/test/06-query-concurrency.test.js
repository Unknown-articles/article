const assert = require("node:assert/strict");
const { test } = require("./harness");
const { bearer, createResource, withContext } = require("./helpers");

async function seedItems(api, token, items) {
  for (const item of items) {
    await createResource(api, token, "items", item);
  }
}

test("Filter: equality (field=value)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10 }, { price: 20 }]);
    const response = await api.get("/items?price=10").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: equality on boolean", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ active: true }, { active: false }]);
    const response = await api.get("/items?active=true").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: inequality (field__ne=value)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10 }, { price: 20 }]);
    const response = await api.get("/items?price__ne=10").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: greater than (field__gt)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10 }, { price: 20 }]);
    const response = await api.get("/items?price__gt=10").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: greater than or equal (field__gte)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10 }, { price: 20 }]);
    const response = await api.get("/items?price__gte=10").set(bearer(users.adminToken));
    assert.equal(response.body.length, 2);
  });
});

test("Filter: less than (field__lt)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10 }, { price: 20 }]);
    const response = await api.get("/items?price__lt=20").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: less than or equal (field__lte)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10 }, { price: 20 }]);
    const response = await api.get("/items?price__lte=10").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: between (field__between=lo,hi, inclusive)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 5 }, { price: 10 }, { price: 15 }]);
    const response = await api.get("/items?price__between=6,14").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: contains (case-insensitive substring)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ name: "Alpha" }, { name: "Beta" }]);
    const response = await api.get("/items?name__contains=PH").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: startswith", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ name: "Alpha" }, { name: "Beta" }]);
    const response = await api.get("/items?name__startswith=Al").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: endswith", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ name: "Alpha" }, { name: "Beta" }]);
    const response = await api.get("/items?name__endswith=ta").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: in (comma-separated list)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10 }, { price: 20 }, { price: 30 }]);
    const response = await api.get("/items?price__in=10,30").set(bearer(users.adminToken));
    assert.equal(response.body.length, 2);
  });
});

test("Filter: AND logic (default) – all conditions must match", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10, active: true }, { price: 10, active: false }]);
    const response = await api.get("/items?price=10&active=true").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
  });
});

test("Filter: OR logic (_or=true) – any condition matches", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 10, active: true }, { price: 20, active: false }]);
    const response = await api.get("/items?price=10&active=false&_or=true").set(bearer(users.adminToken));
    assert.equal(response.body.length, 2);
  });
});

test("Sort: ascending by price", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 20 }, { price: 10 }]);
    const response = await api.get("/items?_sort=price&_order=asc").set(bearer(users.adminToken));
    assert.deepEqual(response.body.map((item) => item.price), [10, 20]);
  });
});

test("Sort: descending by price", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ price: 20 }, { price: 10 }]);
    const response = await api.get("/items?_sort=price&_order=desc").set(bearer(users.adminToken));
    assert.deepEqual(response.body.map((item) => item.price), [20, 10]);
  });
});

test("Sort: ascending by name (alphabetical)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ name: "Beta" }, { name: "Alpha" }]);
    const response = await api.get("/items?_sort=name&_order=asc").set(bearer(users.adminToken));
    assert.deepEqual(response.body.map((item) => item.name), ["Alpha", "Beta"]);
  });
});

test("Pagination: _limit restricts number of results", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ name: "Item 0" }, { name: "Item 1" }, { name: "Item 2" }]);
    const response = await api.get("/items?_limit=2").set(bearer(users.adminToken));
    assert.equal(response.body.length, 2);
  });
});

test("Pagination: _offset skips items", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ name: "Item 0" }, { name: "Item 1" }, { name: "Item 2" }]);
    const response = await api.get("/items?_sort=name&_offset=1").set(bearer(users.adminToken));
    assert.equal(response.body[0].name, "Item 1");
  });
});

test("Pagination: _limit + _offset together", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [{ name: "Item 0" }, { name: "Item 1" }, { name: "Item 2" }, { name: "Item 3" }]);
    const response = await api.get("/items?_sort=name&_offset=1&_limit=2").set(bearer(users.adminToken));
    assert.deepEqual(response.body.map((item) => item.name), ["Item 1", "Item 2"]);
  });
});

test("Combined: filter + sort + pagination", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await seedItems(api, users.adminToken, [
      { category: "a", price: 30 },
      { category: "a", price: 10 },
      { category: "a", price: 20 },
      { category: "b", price: 40 },
    ]);
    const response = await api.get("/items?category=a&_sort=price&_order=asc&_offset=1&_limit=1").set(bearer(users.adminToken));
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].price, 20);
  });
});

test("Concurrent POSTs all succeed with unique IDs (no data loss)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const responses = await Promise.all(Array.from({ length: 10 }, (_, index) => createResource(api, users.adminToken, "items", { index })));
    assert.equal(new Set(responses.map((response) => response.body.id)).size, 10);
    const list = await api.get("/items").set(bearer(users.adminToken));
    assert.equal(list.body.length, 10);
  });
});

test("Concurrent GETs return consistent data without corrupted JSON", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    await Promise.all(Array.from({ length: 5 }, (_, index) => createResource(api, users.adminToken, "items", { index })));
    const responses = await Promise.all(Array.from({ length: 10 }, () => api.get("/items").set(bearer(users.adminToken))));
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.body.length, 5);
    }
  });
});

test("Concurrent PATCHes on same item – all succeed, last write wins (no corruption)", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await createResource(api, users.adminToken, "items", { name: "start", count: 0 });
    const responses = await Promise.all(["one", "two", "three", "four"].map((name) => api.patch(`/items/${created.body.id}`).set(bearer(users.adminToken)).send({ name })));
    for (const response of responses) {
      assert.equal(response.status, 200);
    }
    const current = await api.get(`/items/${created.body.id}`).set(bearer(users.adminToken));
    assert.equal(["one", "two", "three", "four"].includes(current.body.name), true);
  });
});

test("Concurrent DELETEs on different items – all succeed", async () => {
  await withContext(async ({ api, seedUsers }) => {
    const users = await seedUsers();
    const created = await Promise.all([
      createResource(api, users.adminToken, "items", { name: "a" }),
      createResource(api, users.adminToken, "items", { name: "b" }),
      createResource(api, users.adminToken, "items", { name: "c" }),
    ]);
    const responses = await Promise.all(created.map((entry) => api.delete(`/items/${entry.body.id}`).set(bearer(users.adminToken))));
    for (const response of responses) {
      assert.equal(response.status, 204);
    }
    const list = await api.get("/items").set(bearer(users.adminToken));
    assert.equal(list.body.length, 0);
  });
});
