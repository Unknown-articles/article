const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

async function startServer() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "json-api-"));
  const dbPath = path.join(dir, "db.json");
  const port = 4100 + Math.floor(Math.random() * 1000);
  await fs.writeFile(dbPath, '{ "_users": [], "_teams": [] }\n');

  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(port), DB_PATH: dbPath, JWT_SECRET: "test-secret" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    let settled = false;
    let output = "";
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`server did not start. Output: ${output}`));
    }, 15000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes("running on")) finish(resolve);
    });
    child.stderr.on("data", (chunk) => {
      const message = chunk.toString();
      output += message;
      if (message.includes("EADDRINUSE")) {
        child.kill();
        finish(reject, new Error(message));
      }
    });
    child.on("exit", (code) => finish(reject, new Error(`server exited with ${code}. Output: ${output}`)));
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    dbPath,
    stop: () => child.kill(),
  };
}

async function request(baseUrl, method, url, body, token) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { status: response.status, body: json };
}

async function register(baseUrl, username, password) {
  return request(baseUrl, "POST", "/auth/register", { username, password });
}

async function login(baseUrl, username, password) {
  const response = await request(baseUrl, "POST", "/auth/login", { username, password });
  assert.equal(response.status, 200);
  assert.equal(typeof response.body.token, "string");
  return response.body.token;
}

test("health, auth, CRUD, sharing, querying, and concurrency work end to end", async () => {
  const server = await startServer();
  try {
    const health = await request(server.baseUrl, "GET", "/health");
    assert.deepEqual(health.body, { status: "ok" });

    const admin = await register(server.baseUrl, "admin", "secret");
    const user = await register(server.baseUrl, "user", "secret");
    assert.equal(admin.body.role, "admin");
    assert.equal(user.body.role, "user");
    assert.equal(admin.body.password, undefined);

    const adminToken = await login(server.baseUrl, "admin", "secret");
    const userToken = await login(server.baseUrl, "user", "secret");

    const me = await request(server.baseUrl, "GET", "/auth/me", undefined, userToken);
    assert.equal(me.body.username, "user");
    assert.equal(me.body.passwordHash, undefined);

    const created = await request(
      server.baseUrl,
      "POST",
      "/tasks",
      {
        id: "client-id",
        ownerId: "someone",
        title: "Alpha",
        priority: 10,
        active: false,
        sharedWith: [{ userId: user.body.id, access: "write" }],
      },
      adminToken,
    );
    assert.equal(created.status, 201);
    assert.notEqual(created.body.id, "client-id");
    assert.equal(created.body.ownerId, admin.body.id);

    const sharedGet = await request(server.baseUrl, "GET", `/tasks/${created.body.id}`, undefined, userToken);
    assert.equal(sharedGet.status, 200);

    const patched = await request(
      server.baseUrl,
      "PATCH",
      `/tasks/${created.body.id}`,
      { title: "Alpine", id: "bad", ownerId: "bad", createdAt: "bad" },
      userToken,
    );
    assert.equal(patched.status, 200);
    assert.equal(patched.body.title, "Alpine");
    assert.equal(patched.body.id, created.body.id);
    assert.equal(patched.body.ownerId, admin.body.id);
    assert.equal(patched.body.createdAt, created.body.createdAt);
    assert.notEqual(patched.body.updatedAt, patched.body.createdAt);

    const deniedDelete = await request(server.baseUrl, "DELETE", `/tasks/${created.body.id}`, undefined, userToken);
    assert.equal(deniedDelete.status, 403);

    const team = await request(server.baseUrl, "POST", "/auth/teams", { name: "Core" }, adminToken);
    assert.equal(team.status, 201);
    const member = await request(
      server.baseUrl,
      "POST",
      `/auth/teams/${team.body.id}/members`,
      { userId: user.body.id },
      adminToken,
    );
    assert.equal(member.body.members.includes(user.body.id), true);

    await request(
      server.baseUrl,
      "POST",
      "/tasks",
      { title: "Beta", priority: 5, active: true, sharedWithTeams: [{ teamId: team.body.id, access: "read" }] },
      adminToken,
    );
    await request(server.baseUrl, "POST", "/tasks", { title: "Gamma", priority: 1, active: true }, userToken);

    const queried = await request(
      server.baseUrl,
      "GET",
      "/tasks?title__contains=a&priority__gte=1&_sort=priority&_order=desc&_limit=2&_offset=0",
      undefined,
      userToken,
    );
    assert.equal(queried.status, 200);
    assert.equal(queried.body.total >= 2, true);
    assert.equal(queried.body.data.length, 2);
    assert.equal(queried.body.limit, 2);

    const concurrentCreates = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        request(server.baseUrl, "POST", "/events", { index }, adminToken),
      ),
    );
    assert.equal(concurrentCreates.every((response) => response.status === 201), true);
    assert.equal(new Set(concurrentCreates.map((response) => response.body.id)).size, 20);

    const concurrentReads = await Promise.all(
      Array.from({ length: 20 }, () => request(server.baseUrl, "GET", "/events", undefined, adminToken)),
    );
    assert.equal(concurrentReads.every((response) => response.body.length === 20), true);

    const targetId = concurrentCreates[0].body.id;
    const patches = await Promise.all(
      Array.from({ length: 15 }, (_, index) =>
        request(server.baseUrl, "PATCH", `/events/${targetId}`, { patchIndex: index }, adminToken),
      ),
    );
    assert.equal(patches.every((response) => response.status === 200), true);

    const deletes = await Promise.all(
      concurrentCreates
        .slice(1, 11)
        .map((item) => request(server.baseUrl, "DELETE", `/events/${item.body.id}`, undefined, adminToken)),
    );
    assert.equal(deletes.every((response) => response.status === 200), true);

    const db = JSON.parse(await fs.readFile(server.dbPath, "utf8"));
    assert.equal(Array.isArray(db.events), true);
  } finally {
    server.stop();
  }
});
