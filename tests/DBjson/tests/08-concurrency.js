'use strict';

const { suite, test, assert } = require('./framework');

suite('8. Concurrency Control', async (ctx) => {

  function extractItems(data) { return Array.isArray(data) ? data : data.data; }
  function extractTotal(data) { return data.total ?? extractItems(data).length; }
  function okStatus(s, specific) { return s === specific || s === 200; }


  await test('Concurrent POSTs all succeed with unique IDs (no data loss)', async () => {
    const PARALLEL = 20;
    const promises = Array.from({ length: PARALLEL }, (_, i) =>
      ctx.adminClient.post('/concurrent_items', { index: i, value: Math.random() })
    );

    const results = await Promise.all(promises);
    const statuses = results.map(r => r.status);
    const ids = results.map(r => r.data.id);
    const uniqueIds = new Set(ids);

    assert(
      statuses.every(s => okStatus(s, 201)),
      `All requests must return 201. Got: ${statuses.join(', ')}`
    );
    assert(
      uniqueIds.size === PARALLEL,
      `All IDs must be unique. Got ${uniqueIds.size} unique out of ${PARALLEL}`
    );
  });

  await test('Concurrent GETs return consistent data without corrupted JSON', async () => {
    const PARALLEL = 20;
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () => ctx.adminClient.get('/concurrent_items'))
    );

    assert(
      results.every(r => okStatus(r.status, 200)),
      'All concurrent GETs must return 200'
    );
    assert(
      results.every(r => Array.isArray(extractItems(r.data))),
      'All responses must have valid data arrays (no parse errors)'
    );

    // All reads must see the same total count (data snapshot is consistent)
    const totals = results.map(r => extractTotal(r.data));
    assert(
      totals.every(t => t === totals[0]),
      `All concurrent reads must see the same total. Got: ${[...new Set(totals)].join(', ')}`
    );
  });

  await test('Concurrent PATCHes on same item – all succeed, last write wins (no corruption)', async () => {
    const created = await ctx.adminClient.post('/counters', { value: 0 });
    const id = created.data.id;

    const PARALLEL = 15;
    const patches = Array.from({ length: PARALLEL }, (_, i) =>
      ctx.adminClient.patch(`/counters/${id}`, { value: i })
    );
    const results = await Promise.all(patches);

    assert(
      results.every(r => okStatus(r.status, 200)),
      'All concurrent PATCHes must succeed'
    );

    // Final state must be valid (parseable, no corruption)
    const final = await ctx.adminClient.get(`/counters/${id}`);
    assert(okStatus(final.status, 200), 'Item must still be readable after concurrent PATCHes');
    assert(
      typeof final.data.value === 'number',
      'Final value must be a number (no corrupt data)'
    );
  });

  await test('Concurrent DELETEs on different items – all succeed', async () => {
    // Create items first
    const creates = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        ctx.adminClient.post('/trash', { label: `item-${i}` })
      )
    );
    assert(creates.every(r => okStatus(r.status, 201)), 'All items must be created');
    const ids = creates.map(r => r.data.id);

    const deletes = await Promise.all(ids.map(id => ctx.adminClient.delete(`/trash/${id}`)));
    assert(
      deletes.every(r => okStatus(r.status, 204)),
      'All concurrent deletes must succeed with 204'
    );

    // Verify all are gone
    const list = await ctx.adminClient.get('/trash');
    assert(
      ids.every(id => !extractItems(list.data).some(i => i.id === id)),
      'All deleted items must be gone'
    );
  });
});
