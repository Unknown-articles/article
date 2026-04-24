/**
 * Final testability audit — 18 checks across all endpoints and DB state.
 */
import { createVerify, createPublicKey } from 'crypto';
import sqlite3pkg from 'sqlite3';
const { Database } = sqlite3pkg;

const BASE_URL = 'http://localhost:3000';
let failCount = 0;
const pass = (label) => console.log(`  PASS  ${label}`);
const fail = (label, detail) => { console.log(`  FAIL  ${label}: ${detail}`); failCount++; };
const hdr  = (n, title) => console.log(`\n[${n}] ${title}`);

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function httpGet(path, headers = {}) {
  return fetch(`${BASE_URL}${path}`, { headers, redirect: 'manual' });
}
async function httpPost(path, body, headers = {}) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(body).toString(),
  });
}

// ── DB helpers ────────────────────────────────────────────────────────────────
function dbFetchAll(sql, params = []) {
  return new Promise((res, rej) => {
    const db = new Database('data.db');
    db.all(sql, params, (err, rows) => { db.close(); err ? rej(err) : res(rows); });
  });
}
function dbFetchOne(sql, params = []) {
  return new Promise((res, rej) => {
    const db = new Database('data.db');
    db.get(sql, params, (err, row) => { db.close(); err ? rej(err) : res(row); });
  });
}

// ── Flow helpers ─────────────────────────────────────────────────────────────
async function fetchAuthCode(opts = {}) {
  const payload = {
    client_id: 'test-client',
    redirect_uri: opts.redirect_uri || 'http://localhost:8080/callback',
    response_type: 'code',
    scope: opts.scope || 'openid',
    username: 'testuser',
    password: 'password123',
    state: opts.state ?? 'teststate',
  };
  const r = await httpPost('/oauth2/authorize', payload);
  const loc = r.headers.get('location');
  if (!loc) return null;
  return new URL(loc).searchParams.get('code');
}
async function redeemCode(code, opts = {}) {
  const payload = {
    grant_type: 'authorization_code', code,
    redirect_uri: opts.redirect_uri || 'http://localhost:8080/callback',
    ...opts.body,
  };
  const headers = {};
  if (opts.basic) {
    headers['Authorization'] = 'Basic ' +
      Buffer.from(`${opts.basic.id}:${opts.basic.secret}`).toString('base64');
  } else {
    payload.client_id = opts.clientId || 'test-client';
    payload.client_secret = opts.clientSecret || 'test-secret';
  }
  return httpPost('/oauth2/token', payload, headers);
}
function decodeJwtPart(b64) {
  return JSON.parse(Buffer.from(b64, 'base64url').toString());
}

// ════════════════════════════════════════════════════════════════════════════
// 1. openid-configuration fields
// ════════════════════════════════════════════════════════════════════════════
hdr(1, 'GET /.well-known/openid-configuration — required fields');
{
  const r = await httpGet('/.well-known/openid-configuration');
  const j = await r.json();
  const required = [
    ['issuer',                                j.issuer && j.issuer.startsWith('http'),    'issuer missing or not a URL'],
    ['authorization_endpoint /oauth2/authorize', j.authorization_endpoint?.includes('/oauth2/authorize'), 'wrong path'],
    ['token_endpoint /oauth2/token',           j.token_endpoint?.includes('/oauth2/token'),              'wrong path'],
    ['userinfo_endpoint /userinfo',            j.userinfo_endpoint?.includes('/userinfo'),               'wrong path'],
    ['jwks_uri includes jwks',                 j.jwks_uri?.includes('jwks'),                             'wrong path'],
    ['response_types_supported includes code', j.response_types_supported?.includes('code'),             'missing "code"'],
    ['subject_types_supported non-empty',      j.subject_types_supported?.length > 0,                   'empty array'],
    ['id_token_signing_alg includes RS256',    j.id_token_signing_alg_values_supported?.includes('RS256'), 'missing "RS256"'],
  ];
  let ok = true;
  for (const [name, cond, reason] of required) {
    if (!cond) { fail(`1 ${name}`, reason); ok = false; }
  }
  if (ok) pass('1 all required openid-configuration fields present and correct');
}

// ════════════════════════════════════════════════════════════════════════════
// 2. JWKS key structure
// ════════════════════════════════════════════════════════════════════════════
hdr(2, 'GET /.well-known/jwks.json — key structure');
{
  const r = await httpGet('/.well-known/jwks.json');
  const { keys } = await r.json();
  if (!keys?.length) { fail('2 keys array', 'empty or missing'); }
  else {
    const k = keys[0];
    const checks = [
      ['kty=RSA',   k.kty === 'RSA'],
      ['use=sig',   k.use === 'sig'],
      ['alg=RS256', k.alg === 'RS256'],
      ['kid non-empty', k.kid?.length > 0],
      ['n non-empty',   k.n?.length > 0],
      ['e non-empty',   k.e?.length > 0],
    ];
    let ok = true;
    for (const [name, cond] of checks) {
      if (!cond) { fail(`2 ${name}`, JSON.stringify(k)); ok = false; }
    }
    if (ok) pass('2 JWKS key has kty, use, alg, kid, n, e — all correct');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 3. GET /oauth2/authorize — 400 validation cases
// ════════════════════════════════════════════════════════════════════════════
hdr(3, 'GET /oauth2/authorize — 400 for invalid params');
const authBase = '/oauth2/authorize?client_id=test-client&redirect_uri=http://localhost:8080/callback&response_type=code&scope=openid';
{
  const cases = [
    ['missing client_id',    '/oauth2/authorize?redirect_uri=http://localhost:8080/callback&response_type=code&scope=openid'],
    ['unknown client_id',    '/oauth2/authorize?client_id=nope&redirect_uri=http://localhost:8080/callback&response_type=code&scope=openid'],
    ['unregistered redirect','/oauth2/authorize?client_id=test-client&redirect_uri=http://evil.com&response_type=code&scope=openid'],
    ['wrong response_type',  '/oauth2/authorize?client_id=test-client&redirect_uri=http://localhost:8080/callback&response_type=token&scope=openid'],
    ['scope lacks openid',   '/oauth2/authorize?client_id=test-client&redirect_uri=http://localhost:8080/callback&response_type=code&scope=profile'],
  ];
  let ok = true;
  for (const [name, path] of cases) {
    const r = await httpGet(path);
    if (r.status !== 400) { fail(`3 ${name}`, `status ${r.status}`); ok = false; }
  }
  if (ok) pass('3 all invalid param combinations return 400');
}

// ════════════════════════════════════════════════════════════════════════════
// 4. GET /oauth2/authorize — 200 HTML form with required hidden fields
// ════════════════════════════════════════════════════════════════════════════
hdr(4, 'GET /oauth2/authorize — 200 HTML login form');
{
  const r = await httpGet(`${authBase}&state=mystate`);
  const html = await r.text();
  if (r.status !== 200) { fail('4 status', `got ${r.status}`); }
  else {
    const names = ['client_id', 'redirect_uri', 'state', 'response_type', 'scope'];
    let ok = true;
    for (const n of names) {
      if (!html.includes(`name="${n}"`)) { fail(`4 hidden field ${n}`, 'not found in HTML'); ok = false; }
    }
    if (!html.includes('method="POST"') && !html.includes("method='POST'")) {
      fail('4 form method', 'method=POST not found'); ok = false;
    }
    if (!html.includes('action="/oauth2/authorize"')) {
      fail('4 form action', 'action=/oauth2/authorize not found'); ok = false;
    }
    if (ok) pass('4 200 HTML with POST form and all required hidden fields');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 5. POST /oauth2/authorize — 302 with code and state
// ════════════════════════════════════════════════════════════════════════════
hdr(5, 'POST /oauth2/authorize — 302 redirect with code and state');
{
  const r = await httpPost('/oauth2/authorize', {
    client_id: 'test-client', redirect_uri: 'http://localhost:8080/callback',
    response_type: 'code', scope: 'openid', state: 'mystate42',
    username: 'testuser', password: 'password123',
  });
  const loc = r.headers.get('location') || '';
  const u = loc ? new URL(loc) : null;
  if (r.status !== 302) fail('5 status', `got ${r.status}`);
  else if (!u?.searchParams.get('code')) fail('5 code param', 'missing from redirect');
  else if (u.searchParams.get('state') !== 'mystate42') fail('5 state echoed', `got ${u.searchParams.get('state')}`);
  else pass(`5 302 redirect to ${u.origin}${u.pathname} with code and state`);
}

// ════════════════════════════════════════════════════════════════════════════
// 6. POST /oauth2/authorize — wrong credentials re-renders form with error
// ════════════════════════════════════════════════════════════════════════════
hdr(6, 'POST /oauth2/authorize — wrong credentials error message');
{
  const r = await httpPost('/oauth2/authorize', {
    client_id: 'test-client', redirect_uri: 'http://localhost:8080/callback',
    response_type: 'code', scope: 'openid', state: 's',
    username: 'testuser', password: 'WRONG',
  });
  const body = await r.text();
  if (r.status === 302) fail('6 status', 'must not be 302 on wrong credentials');
  else if (!/Invalid|error|incorrect/i.test(body)) fail('6 error message', 'not found in response body');
  else pass(`6 non-302 (${r.status}) with error message in body`);
}

// ════════════════════════════════════════════════════════════════════════════
// 7. Both registered redirect URIs accepted
// ════════════════════════════════════════════════════════════════════════════
hdr(7, 'Both registered redirect URIs accepted');
{
  for (const uri of ['http://localhost:8080/callback', 'http://localhost:3001/callback']) {
    const r = await httpPost('/oauth2/authorize', {
      client_id: 'test-client', redirect_uri: uri,
      response_type: 'code', scope: 'openid', state: 's',
      username: 'testuser', password: 'password123',
    });
    if (r.status !== 302) fail(`7 redirect ${uri}`, `status ${r.status}`);
    else pass(`7 accepted redirect_uri: ${uri}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 8. Token endpoint — both client_auth methods
// ════════════════════════════════════════════════════════════════════════════
hdr(8, 'POST /oauth2/token — body params and HTTP Basic auth');
{
  // body params
  const code1 = await fetchAuthCode();
  const r1 = await redeemCode(code1);
  if (r1.status !== 200) fail('8 body auth', `status ${r1.status}`);
  else pass('8 client auth via body params -> 200');

  // HTTP Basic
  const code2 = await fetchAuthCode();
  const r2 = await redeemCode(code2, { basic: { id: 'test-client', secret: 'test-secret' }, body: {} });
  if (r2.status !== 200) fail('8 Basic auth', `status ${r2.status}`);
  else pass('8 client auth via HTTP Basic -> 200');
}

// ════════════════════════════════════════════════════════════════════════════
// 9. Token endpoint — exact error codes
// ════════════════════════════════════════════════════════════════════════════
hdr(9, 'POST /oauth2/token — exact error codes');
{
  const cases = [
    ['missing grant_type → invalid_request/400',
     { client_id:'test-client', client_secret:'test-secret', code:'x', redirect_uri:'http://localhost:8080/callback' },
     {}, 400, 'invalid_request'],
    ['wrong grant_type → unsupported_grant_type/400',
     { client_id:'test-client', client_secret:'test-secret', grant_type:'implicit', code:'x', redirect_uri:'http://localhost:8080/callback' },
     {}, 400, 'unsupported_grant_type'],
    ['missing code → invalid_request/400',
     { client_id:'test-client', client_secret:'test-secret', grant_type:'authorization_code', redirect_uri:'http://localhost:8080/callback' },
     {}, 400, 'invalid_request'],
    ['missing redirect_uri → invalid_request/400',
     { client_id:'test-client', client_secret:'test-secret', grant_type:'authorization_code', code:'x' },
     {}, 400, 'invalid_request'],
    ['unknown client → invalid_client/401',
     { client_id:'nobody', client_secret:'x', grant_type:'authorization_code', code:'x', redirect_uri:'http://localhost:8080/callback' },
     {}, 401, 'invalid_client'],
    ['wrong secret → invalid_client/401',
     { client_id:'test-client', client_secret:'WRONG', grant_type:'authorization_code', code:'x', redirect_uri:'http://localhost:8080/callback' },
     {}, 401, 'invalid_client'],
    ['bad code → invalid_grant/400',
     { client_id:'test-client', client_secret:'test-secret', grant_type:'authorization_code', code:'BADCODE', redirect_uri:'http://localhost:8080/callback' },
     {}, 400, 'invalid_grant'],
  ];
  let ok = true;
  for (const [desc, body, headers, expStatus, expError] of cases) {
    const r = await httpPost('/oauth2/token', body, headers);
    const j = await r.json();
    if (r.status !== expStatus || j.error !== expError) {
      fail(`9 ${desc}`, `got ${r.status} ${j.error}`); ok = false;
    }
  }
  if (ok) pass('9 all error codes match expected status and error string');
}

// ════════════════════════════════════════════════════════════════════════════
// 10. Successful token response fields
// ════════════════════════════════════════════════════════════════════════════
hdr(10, 'POST /oauth2/token — successful response fields');
let savedTokenResp;
{
  const code = await fetchAuthCode();
  const r = await redeemCode(code);
  const j = await r.json();
  savedTokenResp = j;
  const checks = [
    ['access_token present',    typeof j.access_token === 'string' && j.access_token.length > 0],
    ['id_token present',        typeof j.id_token === 'string' && j.id_token.length > 0],
    ['token_type = Bearer',     j.token_type === 'Bearer'],
    ['expires_in present',      typeof j.expires_in === 'number'],
  ];
  let ok = true;
  for (const [name, cond] of checks) {
    if (!cond) { fail(`10 ${name}`, JSON.stringify(j)); ok = false; }
  }
  if (ok) pass('10 response has access_token, id_token, token_type=Bearer, expires_in');
}

// ════════════════════════════════════════════════════════════════════════════
// 11. id_token is a three-part JWT
// ════════════════════════════════════════════════════════════════════════════
hdr(11, 'id_token — three-part JWT structure');
{
  const parts = savedTokenResp.id_token?.split('.');
  if (!parts || parts.length !== 3) fail('11 JWT parts', `got ${parts?.length}`);
  else {
    try {
      decodeJwtPart(parts[0]);
      decodeJwtPart(parts[1]);
      pass('11 id_token has three base64url parts; header and payload decode as JSON');
    } catch (e) {
      fail('11 JWT decode', e.message);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 12. id_token payload claims
// ════════════════════════════════════════════════════════════════════════════
hdr(12, 'id_token payload — required claims');
let parsedIdTokenPayload;
{
  const [, payB64] = savedTokenResp.id_token.split('.');
  parsedIdTokenPayload = decodeJwtPart(payB64);
  const checks = [
    ['sub present',            typeof parsedIdTokenPayload.sub === 'string' && parsedIdTokenPayload.sub.length > 0],
    ['iss present',            typeof parsedIdTokenPayload.iss === 'string'],
    ['aud includes client_id', parsedIdTokenPayload.aud === 'test-client' ||
                               (Array.isArray(parsedIdTokenPayload.aud) && parsedIdTokenPayload.aud.includes('test-client'))],
    ['exp present',            typeof parsedIdTokenPayload.exp === 'number'],
    ['iat present',            typeof parsedIdTokenPayload.iat === 'number'],
  ];
  let ok = true;
  for (const [name, cond] of checks) {
    if (!cond) { fail(`12 ${name}`, JSON.stringify(parsedIdTokenPayload)); ok = false; }
  }
  if (ok) pass(`12 id_token payload has sub="${parsedIdTokenPayload.sub}", iss, aud, exp, iat`);
}

// ════════════════════════════════════════════════════════════════════════════
// 13. GET /userinfo — 401 cases
// ════════════════════════════════════════════════════════════════════════════
hdr(13, 'GET /userinfo — 401 for absent/invalid auth');
{
  const cases = [
    ['no Authorization header',    {}],
    ['Basic scheme',               { Authorization: 'Basic dXNlcjpwYXNz' }],
    ['invalid token',              { Authorization: 'Bearer notarealtoken' }],
  ];
  let ok = true;
  for (const [name, headers] of cases) {
    const r = await httpGet('/userinfo', headers);
    if (r.status !== 401) { fail(`13 ${name}`, `status ${r.status}`); ok = false; }
  }
  if (ok) pass('13 all invalid/absent auth scenarios return 401');
}

// ════════════════════════════════════════════════════════════════════════════
// 14. GET /userinfo — 200 with sub and email
// ════════════════════════════════════════════════════════════════════════════
hdr(14, 'GET /userinfo — 200 with sub and email');
let userInfoSubject;
{
  const code = await fetchAuthCode({ scope: 'openid email' });
  const tr = await redeemCode(code);
  const { access_token } = await tr.json();
  const r = await httpGet('/userinfo', { Authorization: `Bearer ${access_token}` });
  const j = await r.json();
  userInfoSubject = j.sub;
  if (r.status !== 200) fail('14 status', `got ${r.status}`);
  else if (!j.sub) fail('14 sub', 'missing from userinfo response');
  else if (!j.email) fail('14 email', 'missing (scope includes "email")');
  else pass(`14 200 userinfo: sub="${j.sub}", email="${j.email}"`);
}

// ════════════════════════════════════════════════════════════════════════════
// 15. sub matches between userinfo and id_token
// ════════════════════════════════════════════════════════════════════════════
hdr(15, 'sub consistency: userinfo vs id_token');
{
  if (!userInfoSubject || !parsedIdTokenPayload?.sub) {
    fail('15 sub match', 'could not compare — earlier check failed');
  } else if (userInfoSubject !== parsedIdTokenPayload.sub) {
    fail('15 sub match', `userinfo sub="${userInfoSubject}" vs id_token sub="${parsedIdTokenPayload.sub}"`);
  } else {
    pass(`15 sub="${userInfoSubject}" matches in both userinfo and id_token`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 16. Seed data present on startup
// ════════════════════════════════════════════════════════════════════════════
hdr(16, 'Database — seed data present');
{
  const client = await dbFetchOne("SELECT * FROM clients WHERE client_id='test-client'");
  const user   = await dbFetchOne("SELECT * FROM users WHERE username='testuser'");
  if (!client) fail('16 test-client', 'not found in clients table');
  else {
    const uris = JSON.parse(client.redirect_uris);
    if (!uris.includes('http://localhost:8080/callback') || !uris.includes('http://localhost:3001/callback'))
      fail('16 redirect_uris', `got ${client.redirect_uris}`);
    else pass('16 test-client seeded with both redirect_uris');
  }
  if (!user) fail('16 testuser', 'not found in users table');
  else if (user.email !== 'testuser@example.com') fail('16 testuser email', user.email);
  else pass(`16 testuser seeded with email=${user.email}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 17. Re-seeding does not duplicate data
// ════════════════════════════════════════════════════════════════════════════
hdr(17, 'Database — no duplicate seed data on re-run');
{
  const clients = await dbFetchAll("SELECT id FROM clients WHERE client_id='test-client'");
  const users   = await dbFetchAll("SELECT id FROM users WHERE username='testuser'");
  if (clients.length !== 1) fail('17 duplicate clients', `found ${clients.length} rows`);
  else pass('17 exactly one test-client row');
  if (users.length !== 1) fail('17 duplicate users', `found ${users.length} rows`);
  else pass('17 exactly one testuser row');
}

// ════════════════════════════════════════════════════════════════════════════
// 18. All four tables exist with correct column names
// ════════════════════════════════════════════════════════════════════════════
hdr(18, 'Database — all four tables with correct columns');
{
  const expected = {
    users:      ['id','username','password','email'],
    clients:    ['id','client_id','client_secret','redirect_uris'],
    auth_codes: ['id','code','client_id','user_id','redirect_uri','scope',
                 'code_challenge','code_challenge_method','expires_at','used'],
    tokens:     ['id','access_token','client_id','user_id','scope','expires_at'],
  };
  let ok = true;
  for (const [table, cols] of Object.entries(expected)) {
    const rows = await dbFetchAll(`PRAGMA table_info(${table})`);
    if (!rows.length) { fail(`18 table ${table}`, 'not found'); ok = false; continue; }
    const actual = rows.map(r => r.name);
    for (const col of cols) {
      if (!actual.includes(col)) { fail(`18 ${table}.${col}`, `missing; got [${actual}]`); ok = false; }
    }
  }
  if (ok) pass('18 all four tables present with all required columns');
}

// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(56)}`);
console.log(failCount === 0
  ? 'All 18 checks passed.'
  : `${failCount} check(s) FAILED.`);
process.exit(failCount > 0 ? 1 : 0);
