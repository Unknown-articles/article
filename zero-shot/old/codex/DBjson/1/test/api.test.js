const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { FileStore } = require("../src/db/fileStore");
const { DataService } = require("../src/services/dataService");
const { AuthService } = require("../src/services/authService");
const { createApp } = require("../src/app");

async function createTestServer() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dbjson-test-"));
  const filePath = path.join(tempDir, "db.json");
  const store = new FileStore(filePath);
  await store.initialize();

  const app = createApp({
    dataService: new DataService(store),
    authService: new AuthService(store),
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function requestJson(baseUrl, pathname, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();
  return {
    status: response.status,
    body: payload,
  };
}

async function main() {
  const { server, baseUrl } = await createTestServer();

  try {
    const admin = await requestJson(baseUrl, "/auth/register", {
      method: "POST",
      body: { username: "admin", password: "secret", role: "admin" },
    });
    const writer = await requestJson(baseUrl, "/auth/register", {
      method: "POST",
      body: { username: "writer", password: "secret", role: "user" },
    });
    const reader = await requestJson(baseUrl, "/auth/register", {
      method: "POST",
      body: { username: "reader", password: "secret", role: "user" },
    });

    const team = await requestJson(baseUrl, "/auth/teams", {
      method: "POST",
      body: { name: "ops" },
      token: admin.body.token,
    });
    await requestJson(baseUrl, `/auth/teams/${team.body.id}/members`, {
      method: "POST",
      body: { userId: reader.body.user.id },
      token: admin.body.token,
    });

    const keyboard = await requestJson(baseUrl, "/products", {
      method: "POST",
      body: { name: "Keyboard", price: 120, category: "hardware" },
      token: admin.body.token,
    });
    await requestJson(baseUrl, "/products", {
      method: "POST",
      body: { name: "Mouse", price: 45, category: "hardware" },
      token: admin.body.token,
    });

    const share = await requestJson(baseUrl, `/products/${keyboard.body.id}/share`, {
      method: "POST",
      body: {
        users: [{ userId: writer.body.user.id, access: "write" }],
        teams: [{ teamId: team.body.id, access: "read" }],
      },
      token: admin.body.token,
    });

    assert.equal(share.status, 200);

    const writerPatch = await requestJson(baseUrl, `/products/${keyboard.body.id}`, {
      method: "PATCH",
      body: { price: 140 },
      token: writer.body.token,
    });
    assert.equal(writerPatch.status, 200);
    assert.equal(writerPatch.body.data.price, 140);

    const readerDelete = await requestJson(baseUrl, `/products/${keyboard.body.id}`, {
      method: "DELETE",
      token: reader.body.token,
    });
    assert.equal(readerDelete.status, 403);

    const filtered = await requestJson(
      baseUrl,
      '/products?filter={"and":[{"field":"price","op":">=","value":100},{"field":"name","op":"contains","value":"key"}]}&sort=price:desc&limit=5&offset=0',
      {
        token: admin.body.token,
      },
    );

    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.meta.total, 1);
    assert.equal(filtered.body.items[0].data.name, "Keyboard");

    console.log("All tests passed");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
