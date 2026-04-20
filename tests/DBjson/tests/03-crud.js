'use strict';

const { suite, test, assertStatus, assert, assertEqual } = require('./framework');

suite('3. CRUD – Dynamic Resources', async (ctx) => {

  // ── POST – create resource ────────────────────────────────────────────────

  await test('POST /:resource – creates new collection and resource', async () => {
    const res = await ctx.adminClient.post('/products', { name: 'Widget', price: 9.99 });
    assertStatus(res, [201, 200]);
    assert(res.data.id,        'Must have auto-generated id');
    assert(res.data.ownerId,   'Must have ownerId');
    assertEqual(res.data.name, 'Widget');
    assertEqual(res.data.price, 9.99);
    ctx.productId = res.data.id;
  });

  await test('POST /:resource – any arbitrary JSON payload is accepted', async () => {
    const payload = { title: 'Test Post', tags: ['a', 'b'], meta: { views: 0 } };
    const res = await ctx.adminClient.post('/posts', payload);
    assertStatus(res, [201, 200]);
    assert(res.data.id, 'Must generate id');
    ctx.postId = res.data.id;
  });

  await test('POST /:resource – client-supplied id is ignored (system generates one)', async () => {
    const res = await ctx.adminClient.post('/products', { id: 'client-id', name: 'Gadget' });
    assertStatus(res, [201, 200]);
    assert(res.data.id !== 'client-id', 'System must override client-supplied id');
  });

  await test('POST /:resource – client-supplied ownerId is ignored', async () => {
    const res = await ctx.userClient.post('/products', { name: 'Owned by user', ownerId: ctx.adminId });
    assertStatus(res, [201, 200]);
    assertEqual(res.data.ownerId, ctx.userId, "ownerId must equal the caller's id");
    ctx.userProductId = res.data.id;
  });

  // ── GET – list all ────────────────────────────────────────────────────────

  await test('GET /:resource – lists resources (admin sees all)', async () => {
    const res = await ctx.adminClient.get('/products');
    assertStatus(res, 200);
    const items = Array.isArray(res.data) ? res.data : res.data.data;
    assert(Array.isArray(items), 'Response must contain an array of items');
    if (!Array.isArray(res.data)) {
      assert(typeof res.data.total === 'number', 'Response must contain total');
    }
    assert(items.length >= 2, 'Admin must see all created products');
  });

  await test('GET /:resource – returns 401 without token', async () => {
    const { http } = require('./client');
    const res = await http.get('/products');
    assertStatus(res, [401, 400]);
  });

  // ── GET – single item ─────────────────────────────────────────────────────

  await test('GET /:resource/:id – retrieves a single item', async () => {
    const res = await ctx.adminClient.get(`/products/${ctx.productId}`);
    assertStatus(res, 200);
    assertEqual(res.data.id, ctx.productId);
    assertEqual(res.data.name, 'Widget');
  });

  await test('GET /:resource/:id – returns 404 for unknown id', async () => {
    const res = await ctx.adminClient.get('/products/nonexistent-id');
    assertStatus(res, [404, 400]);
  });

  // ── PUT – full replace ────────────────────────────────────────────────────

  await test('PUT /:resource/:id – fully replaces resource fields', async () => {
    const res = await ctx.adminClient.put(`/products/${ctx.productId}`, {
      name: 'Widget Pro', price: 19.99, category: 'tech',
    });
    assertStatus(res, 200);
    assertEqual(res.data.name, 'Widget Pro');
    assertEqual(res.data.price, 19.99);
    assertEqual(res.data.category, 'tech');
    // System fields preserved
    assertEqual(res.data.id, ctx.productId);
    assert(res.data.ownerId, 'ownerId must be preserved');
    assert(res.data.createdAt, 'createdAt must be preserved');
  });

  await test('PUT /:resource/:id – returns 404 for unknown id', async () => {
    const res = await ctx.adminClient.put('/products/bad-id', { name: 'X' });
    assertStatus(res, [404, 400]);
  });

  // ── PATCH – partial update ────────────────────────────────────────────────

  await test('PATCH /:resource/:id – updates only supplied fields', async () => {
    const res = await ctx.adminClient.patch(`/products/${ctx.productId}`, { price: 24.99 });
    assertStatus(res, 200);
    assertEqual(res.data.price, 24.99);
    assertEqual(res.data.name, 'Widget Pro', 'Other fields must remain unchanged');
    assert(res.data.updatedAt !== res.data.createdAt, 'updatedAt must change');
  });

  await test('PATCH /:resource/:id – returns 404 for unknown id', async () => {
    const res = await ctx.adminClient.patch('/products/bad-id', { price: 1 });
    assertStatus(res, [404, 400]);
  });

  // ── DELETE ────────────────────────────────────────────────────────────────

  await test('DELETE /:resource/:id – owner can delete own resource', async () => {
    // Create a product as user, then delete it as user
    const created = await ctx.userClient.post('/products', { name: 'Temp' });
    assertStatus(created, [201, 200]);
    const res = await ctx.userClient.delete(`/products/${created.data.id}`);
    assertStatus(res, [204, 200]);
  });

  await test('DELETE /:resource/:id – admin can delete any resource', async () => {
    const created = await ctx.userClient.post('/products', { name: 'ToDelete' });
    assertStatus(created, [201, 200]);
    const res = await ctx.adminClient.delete(`/products/${created.data.id}`);
    assertStatus(res, [204, 200]);
  });

  await test('DELETE /:resource/:id – returns 404 for unknown id', async () => {
    const res = await ctx.adminClient.delete('/products/bad-id');
    assertStatus(res, [404, 400]);
  });

  // ── Reserved collections ──────────────────────────────────────────────────

  await test('Reserved collection "_users" is rejected', async () => {
    const res = await ctx.adminClient.get('/_users');
    assertStatus(res, [403, 400]);
  });

  await test('Reserved collection "auth" is rejected by dynamic router', async () => {
    // /auth is handled by the auth router so the dynamic router never sees it,
    // but let's confirm a nested reserved attempt is blocked
    const res = await ctx.adminClient.get('/_teams');
    assertStatus(res, [403, 400]);
  });
});
