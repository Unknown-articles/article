'use strict';

const { suite, test, assertStatus, assert, assertEqual } = require('./framework');

suite('7. Advanced Querying', async (ctx) => {

  // Normaliza lista: aceita { data: [...], total, ... } ou array direto
  function extractItems(data) {
    return Array.isArray(data) ? data : data.data;
  }

  // Metadados opcionais — só existem no formato envelopado
  function extractTotal(data, fallback)  { return data.total  ?? fallback; }
  function extractLimit(data, fallback)  { return data.limit  ?? fallback; }
  function extractOffset(data, fallback) { return data.offset ?? fallback; }

  // Seed a collection with known data for query tests
  const items = [
    { name: 'Apple',    price: 1.5, category: 'fruit',  stock: 100, active: true  },
    { name: 'Banana',   price: 0.5, category: 'fruit',  stock: 200, active: true  },
    { name: 'Carrot',   price: 2.0, category: 'veggie', stock: 50,  active: false },
    { name: 'Date',     price: 5.0, category: 'fruit',  stock: 30,  active: true  },
    { name: 'Eggplant', price: 3.5, category: 'veggie', stock: 80,  active: true  },
  ];

  // Seed catalog data
  for (const item of items) {
    const res = await ctx.adminClient.post('/catalog', item);
    assertStatus(res, [201, 200]);
  }

  // ── Equality filter ───────────────────────────────────────────────────────

  await test('Filter: equality (field=value)', async () => {
    const res = await ctx.adminClient.get('/catalog?category=fruit');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.category === 'fruit'), 'All results must be fruit');
    assertEqual(data.length, 3);
  });

  await test('Filter: equality on boolean', async () => {
    const res = await ctx.adminClient.get('/catalog?active=false');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.active === false), 'Must return only inactive items');
    assertEqual(data.length, 1);
  });

  // ── Inequality filter ─────────────────────────────────────────────────────

  await test('Filter: inequality (field__ne=value)', async () => {
    const res = await ctx.adminClient.get('/catalog?category__ne=fruit');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.category !== 'fruit'), 'Must exclude fruit');
    assertEqual(data.length, 2);
  });

  // ── Numeric comparisons ───────────────────────────────────────────────────

  await test('Filter: greater than (field__gt)', async () => {
    const res = await ctx.adminClient.get('/catalog?price__gt=2');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.price > 2), 'All must have price > 2');
    assertEqual(data.length, 2); // Date (5.0), Eggplant (3.5)
  });

  await test('Filter: greater than or equal (field__gte)', async () => {
    const res = await ctx.adminClient.get('/catalog?price__gte=2');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.price >= 2), 'All must have price >= 2');
    assertEqual(data.length, 3); // Carrot (2.0), Date (5.0), Eggplant (3.5)
  });

  await test('Filter: less than (field__lt)', async () => {
    const res = await ctx.adminClient.get('/catalog?price__lt=2');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.price < 2), 'All must have price < 2');
    assertEqual(data.length, 2); // Apple (1.5), Banana (0.5)
  });

  await test('Filter: less than or equal (field__lte)', async () => {
    const res = await ctx.adminClient.get('/catalog?price__lte=2');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.price <= 2), 'All must have price <= 2');
    assertEqual(data.length, 3);
  });

  // ── Between ───────────────────────────────────────────────────────────────

  await test('Filter: between (field__between=lo,hi, inclusive)', async () => {
    const res = await ctx.adminClient.get('/catalog?price__between=1.5,3.5');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.price >= 1.5 && i.price <= 3.5), 'Must be within range');
    // Apple (1.5), Carrot (2.0), Eggplant (3.5)
    assertEqual(data.length, 3);
  });

  // ── String matching ───────────────────────────────────────────────────────

  await test('Filter: contains (case-insensitive substring)', async () => {
    const res = await ctx.adminClient.get('/catalog?name__contains=a');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.name.toLowerCase().includes('a')), 'All names must contain "a"');
    // Apple(a), Banana(a), Carrot(a), Date(a), Eggplant(a) — all 5
    assertEqual(data.length, 5);
  });

  await test('Filter: startswith', async () => {
    const res = await ctx.adminClient.get('/catalog?name__startswith=B');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.name.toLowerCase().startsWith('b')));
    assertEqual(data.length, 1);
  });

  await test('Filter: endswith', async () => {
    const res = await ctx.adminClient.get('/catalog?name__endswith=e');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.name.toLowerCase().endsWith('e')));
    // Apple(e), Date(e) → 2
    assert(data.length >= 1, 'Must return at least one match');
  });

  // ── In list ───────────────────────────────────────────────────────────────

  await test('Filter: in (comma-separated list)', async () => {
    const res = await ctx.adminClient.get('/catalog?category__in=fruit,veggie');
    assertStatus(res, 200);
    assertEqual(extractItems(res.data).length, 5); // all items
  });

  // ── AND vs OR logic ───────────────────────────────────────────────────────

  await test('Filter: AND logic (default) – all conditions must match', async () => {
    const res = await ctx.adminClient.get('/catalog?category=fruit&active=true');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.category === 'fruit' && i.active === true), 'Both conditions must hold');
    assertEqual(data.length, 3); // Apple, Banana, Date
  });

  await test('Filter: OR logic (_or=true) – any condition matches', async () => {
    const res = await ctx.adminClient.get('/catalog?category=veggie&active=false&_or=true');
    assertStatus(res, 200);
    // veggie items: Carrot, Eggplant; active=false: Carrot → union = Carrot, Eggplant
    assert(extractItems(res.data).length >= 2, 'OR must include items matching either condition');
  });

  // ── Sorting ───────────────────────────────────────────────────────────────

  await test('Sort: ascending by price', async () => {
    const res = await ctx.adminClient.get('/catalog?_sort=price&_order=asc');
    assertStatus(res, 200);
    const prices = extractItems(res.data).map(i => i.price);
    for (let i = 1; i < prices.length; i++) {
      assert(prices[i] >= prices[i - 1], `prices must be ascending at index ${i}`);
    }
  });

  await test('Sort: descending by price', async () => {
    const res = await ctx.adminClient.get('/catalog?_sort=price&_order=desc');
    assertStatus(res, 200);
    const prices = extractItems(res.data).map(i => i.price);
    for (let i = 1; i < prices.length; i++) {
      assert(prices[i] <= prices[i - 1], `prices must be descending at index ${i}`);
    }
  });

  await test('Sort: ascending by name (alphabetical)', async () => {
    const res = await ctx.adminClient.get('/catalog?_sort=name&_order=asc');
    assertStatus(res, 200);
    const names = extractItems(res.data).map(i => i.name);
    for (let i = 1; i < names.length; i++) {
      assert(
        names[i].localeCompare(names[i - 1]) >= 0,
        `names must be alphabetically ascending at index ${i}: ${names[i - 1]} > ${names[i]}`
      );
    }
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  await test('Pagination: _limit restricts number of results', async () => {
    const res = await ctx.adminClient.get('/catalog?_limit=2');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assertEqual(data.length, 2);
    assertEqual(extractTotal(res.data, data.length), 5);
    assertEqual(extractLimit(res.data, data.length), 2);
  });

  await test('Pagination: _offset skips items', async () => {
    const all   = await ctx.adminClient.get('/catalog?_sort=name&_order=asc');
    const paged = await ctx.adminClient.get('/catalog?_sort=name&_order=asc&_offset=2');
    assertStatus(paged, 200);
    assertEqual(extractItems(paged.data)[0].name, extractItems(all.data)[2].name);
    assertEqual(extractOffset(paged.data, 2), 2);
  });

  await test('Pagination: _limit + _offset together', async () => {
    const res = await ctx.adminClient.get('/catalog?_sort=name&_order=asc&_limit=2&_offset=1');
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assertEqual(data.length, 2);
    assertEqual(extractTotal(res.data, 5), 5);
    assertEqual(extractOffset(res.data, 1), 1);
    assertEqual(extractLimit(res.data, 2), 2);
  });

  // ── Filter + Sort + Pagination combined ───────────────────────────────────

  await test('Combined: filter + sort + pagination', async () => {
    const res = await ctx.adminClient.get(
      '/catalog?category=fruit&_sort=price&_order=desc&_limit=2&_offset=0'
    );
    assertStatus(res, 200);
    const data = extractItems(res.data);
    assert(data.every(i => i.category === 'fruit'), 'Filter must apply');
    assertEqual(data.length, 2);
    assertEqual(extractTotal(res.data, 3), 3); // 3 fruit items total
    assert(data[0].price >= data[1].price, 'Results must be sorted desc by price');
  });
});
