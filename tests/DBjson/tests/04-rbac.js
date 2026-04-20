'use strict';

const { suite, test, assertStatus, assert, assertEqual } = require('./framework');

suite('4. Role-Based Access Control (RBAC)', async (ctx) => {

  // ── Admin can read user-owned resources ───────────────────────────────────

  await test('Admin can GET single item owned by another user', async () => {
    const res = await ctx.adminClient.get(`/products/${ctx.userProductId}`);
    assertStatus(res, 200);
    assertEqual(res.data.ownerId, ctx.userId);
  });

  await test('Admin can PATCH item owned by another user', async () => {
    const res = await ctx.adminClient.patch(`/products/${ctx.userProductId}`, { price: 1 });
    assertStatus(res, 200);
  });

  await test('Admin can DELETE item owned by another user', async () => {
    const tmp = await ctx.userClient.post('/widgets', { label: 'adminDelete' });
    assertStatus(tmp, [201, 200]);
    const res = await ctx.adminClient.delete(`/widgets/${tmp.data.id}`);
    assertStatus(res, [204, 200]);
  });

  // ── Regular user cannot access other user's private resources ─────────────

  await test('User cannot GET item owned by another user (no sharing)', async () => {
    const res = await ctx.userClient.get(`/products/${ctx.productId}`);
    // productId is owned by admin with no sharing configured
    assertStatus(res, [403, 400]);
  });

  await test('User cannot PUT item owned by another user', async () => {
    const res = await ctx.userClient.put(`/products/${ctx.productId}`, { name: 'Hacked' });
    assertStatus(res, [403, 400]);
  });

  await test('User cannot PATCH item owned by another user', async () => {
    const res = await ctx.userClient.patch(`/products/${ctx.productId}`, { price: 0 });
    assertStatus(res, [403, 400]);
  });

  await test('User cannot DELETE item owned by another user', async () => {
    const res = await ctx.userClient.delete(`/products/${ctx.productId}`);
    assertStatus(res, [403, 400]);
  });

  // ── User can access their own resources ───────────────────────────────────

  await test('User can GET their own resource', async () => {
    const res = await ctx.userClient.get(`/products/${ctx.userProductId}`);
    assertStatus(res, 200);
  });

  await test('User can PATCH their own resource', async () => {
    const res = await ctx.userClient.patch(`/products/${ctx.userProductId}`, { note: 'mine' });
    assertStatus(res, 200);
    assertEqual(res.data.note, 'mine');
  });

  await test('User can PUT their own resource', async () => {
    const res = await ctx.userClient.put(`/products/${ctx.userProductId}`, { name: 'My Product v2' });
    assertStatus(res, 200);
    assertEqual(res.data.name, 'My Product v2');
  });

  // ── List is filtered by ownership ─────────────────────────────────────────

  await test('GET list – user only sees own items (no sharing)', async () => {
    // Create a private collection with one admin item and one user item
    await ctx.adminClient.post('/private_col', { secret: 'admin' });
    await ctx.userClient.post('/private_col', { secret: 'user' });

    const res = await ctx.userClient.get('/private_col');
    assertStatus(res, 200);
    const items = Array.isArray(res.data) ? res.data : res.data.data;
    assert(
      items.every(item => item.ownerId === ctx.userId),
      'Regular user must only see own items in unshared collection'
    );
    assertEqual(items.length, 1);
  });

  await test('GET list – admin sees all items', async () => {
    const res = await ctx.adminClient.get('/private_col');
    assertStatus(res, 200);
    const total = Array.isArray(res.data) ? res.data.length : (res.data.total ?? res.data.data?.length ?? 0);
    assert(total >= 2, 'Admin must see all items');
  });
});
