'use strict';

const { suite, test, assertStatus, assert, assertEqual } = require('./framework');
const { http, authed } = require('./client');

// Normaliza a resposta: aceita { user: {...} } ou o objeto direto
function extractUser(data) {
  return data.user ?? data;
}

suite('2. Authentication', async (ctx) => {

  const suffix = Date.now();
  const adminUser    = { username: `admin_${suffix}`, password: 'Admin@123' };
  const regularUser  = { username: `user_${suffix}`,  password: 'User@123'  };

  // ── Register ──────────────────────────────────────────────────────────────

  await test('POST /auth/register – first user becomes admin', async () => {
    const res = await http.post('/auth/register', adminUser);
    assertStatus(res, [201, 200]);
    const user = extractUser(res.data);
    assert(user.id,   'Response must have user.id');
    assertEqual(user.role, 'admin', 'First registered user must be admin');
    assert(!user.password, 'Password must not be returned');
    ctx.adminId       = user.id;
    ctx.adminUsername = adminUser.username;
    ctx.adminPassword = adminUser.password;
  });

  await test('POST /auth/register – second user gets "user" role', async () => {
    const res = await http.post('/auth/register', regularUser);
    assertStatus(res, [201, 200]);
    const user = extractUser(res.data);
    assertEqual(user.role, 'user');
    ctx.userId       = user.id;
    ctx.userUsername = regularUser.username;
    ctx.userPassword = regularUser.password;
  });

  await test('POST /auth/register – rejects duplicate username', async () => {
    const res = await http.post('/auth/register', adminUser);
    assertStatus(res, [409, 400]);
  });

  await test('POST /auth/register – rejects missing fields', async () => {
    const res = await http.post('/auth/register', { username: 'onlyname' });
    assertStatus(res, 400);
  });

  // ── Login ─────────────────────────────────────────────────────────────────

  await test('POST /auth/login – admin can login and receives JWT', async () => {
    const res = await http.post('/auth/login', adminUser);
    assertStatus(res, 200);
    assert(res.data.token, 'Must return token');
    ctx.adminToken  = res.data.token;
    ctx.adminClient = authed(ctx.adminToken);
  });

  await test('POST /auth/login – regular user can login and receives JWT', async () => {
    const res = await http.post('/auth/login', regularUser);
    assertStatus(res, 200);
    ctx.userToken  = res.data.token;
    ctx.userClient = authed(ctx.userToken);
  });

  await test('POST /auth/login – wrong password returns 401', async () => {
    const res = await http.post('/auth/login', { ...adminUser, password: 'wrong' });
    assertStatus(res, [401, 400]);
  });

  await test('POST /auth/login – unknown username returns 401', async () => {
    const res = await http.post('/auth/login', { username: 'nobody', password: 'x' });
    assertStatus(res, [401, 400]);
  });

  // ── /auth/me ──────────────────────────────────────────────────────────────

  await test('GET /auth/me – returns caller profile', async () => {
    const res = await ctx.adminClient.get('/auth/me');
    assertStatus(res, 200);
    const user = extractUser(res.data);
    assertEqual(user.username, ctx.adminUsername);
    assert(!user.password, 'Password must not be returned');
  });

  await test('GET /auth/me – rejects unauthenticated request', async () => {
    const res = await http.get('/auth/me');
    assertStatus(res, [401, 400]);
  });

  // ── Admin – list users ────────────────────────────────────────────────────

  await test('GET /auth/users – admin can list all users', async () => {
    const res = await ctx.adminClient.get('/auth/users');
    assertStatus(res, 200);
    const users = res.data.users ?? res.data;
    assert(Array.isArray(users), 'Must return users array');
    assert(users.length >= 2, 'Must contain at least 2 users');
    assert(users.every(u => !u.password), 'Passwords must not be returned');
  });

  await test('GET /auth/users – regular user is forbidden', async () => {
    const res = await ctx.userClient.get('/auth/users');
    assertStatus(res, [403, 400]);
  });

  // ── Admin – change role ───────────────────────────────────────────────────

  await test('PATCH /auth/users/:id/role – admin can promote user to admin', async () => {
    const res = await ctx.adminClient.patch(`/auth/users/${ctx.userId}/role`, { role: 'admin' });
    assertStatus(res, 200);
    const user = extractUser(res.data);
    assertEqual(user.role, 'admin');
  });

  await test('PATCH /auth/users/:id/role – admin can demote back to user', async () => {
    const res = await ctx.adminClient.patch(`/auth/users/${ctx.userId}/role`, { role: 'user' });
    assertStatus(res, 200);
    const user = extractUser(res.data);
    assertEqual(user.role, 'user');
  });

  await test('PATCH /auth/users/:id/role – invalid role is rejected', async () => {
    const res = await ctx.adminClient.patch(`/auth/users/${ctx.userId}/role`, { role: 'superuser' });
    assertStatus(res, 400);
  });

  await test('PATCH /auth/users/:id/role – non-admin is forbidden', async () => {
    const res = await ctx.userClient.patch(`/auth/users/${ctx.adminId}/role`, { role: 'user' });
    assertStatus(res, [403, 400]);
  });
});
