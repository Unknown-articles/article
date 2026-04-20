'use strict';

const { suite, test, assertStatus, assert, assertEqual } = require('./framework');

suite('5. Data Ownership', async (ctx) => {

  await test('Every created resource has ownerId equal to creator', async () => {
    const adminRes = await ctx.adminClient.post('/notes', { text: 'admin note' });
    assertStatus(adminRes, [201, 200]);
    assertEqual(adminRes.data.ownerId, ctx.adminId, 'admin\'s note must have admin\'s id');

    const userRes = await ctx.userClient.post('/notes', { text: 'user note' });
    assertStatus(userRes, [201, 200]);
    assertEqual(userRes.data.ownerId, ctx.userId, 'user\'s note must have user\'s id');

    ctx.adminNoteId = adminRes.data.id;
    ctx.userNoteId  = userRes.data.id;
  });

  await test('Owner can modify their own resource', async () => {
    const res = await ctx.userClient.patch(`/notes/${ctx.userNoteId}`, { text: 'updated' });
    assertStatus(res, 200);
    assertEqual(res.data.text, 'updated');
  });

  await test('Non-owner user cannot modify another user\'s resource', async () => {
    const res = await ctx.userClient.patch(`/notes/${ctx.adminNoteId}`, { text: 'hacked' });
    assertStatus(res, [403, 400]);
  });

  await test('Only owner or admin can delete – shared-write user cannot delete', async () => {
    // Create item owned by admin, share write access with user
    const created = await ctx.adminClient.post('/docs', {
      content: 'secret',
      sharedWith: [{ userId: ctx.userId, access: 'write' }],
    });
    assertStatus(created, [201, 200]);
    ctx.sharedWriteDocId = created.data.id;

    // User has write access but cannot DELETE (owner-only restriction)
    const delRes = await ctx.userClient.delete(`/docs/${ctx.sharedWriteDocId}`);
    assertStatus(delRes, [403, 400]);

    // Admin (owner) can delete it
    const adminDel = await ctx.adminClient.delete(`/docs/${ctx.sharedWriteDocId}`);
    assertStatus(adminDel, [204, 200]);
  });

  await test('System fields (id, ownerId, createdAt) cannot be overwritten by client', async () => {
    const created = await ctx.userClient.post('/items', { label: 'test' });
    assertStatus(created, [201, 200]);
    const originalId      = created.data.id;
    const originalOwnerId = created.data.ownerId;
    const originalCreated = created.data.createdAt;

    const patched = await ctx.userClient.patch(`/items/${originalId}`, {
      id:        'evil-id',
      ownerId:   ctx.adminId,
      createdAt: '1970-01-01',
    });
    assertStatus(patched, 200);
    assertEqual(patched.data.id,        originalId,      'id must not change');
    assertEqual(patched.data.ownerId,   originalOwnerId, 'ownerId must not change');
    assertEqual(patched.data.createdAt, originalCreated, 'createdAt must not change');
  });
});
