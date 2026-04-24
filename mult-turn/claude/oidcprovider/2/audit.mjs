import { createHash, createVerify, createPublicKey } from 'crypto';
import { readFileSync } from 'fs';
import sqlite3pkg from 'sqlite3';
const { Database } = sqlite3pkg;

const BASE_URL = 'http://localhost:3000';
let failCount = 0;
const pass = (label) => console.log(`  PASS  ${label}`);
const fail = (label, detail) => { console.log(`  FAIL  ${label}: ${detail}`); failCount++; };

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
async function fetchAuthCode(opts = {}) {
  const payload = {
    client_id: 'test-client', redirect_uri: 'http://localhost:8080/callback',
    response_type: 'code', scope: opts.scope || 'openid',
    username: 'testuser', password: 'password123', state: 's',
  };
  if (opts.challenge) { payload.code_challenge = opts.challenge; payload.code_challenge_method = opts.method; }
  const r = await httpPost('/oauth2/authorize', payload);
  const loc = r.headers.get('location');
  return new URL(loc).searchParams.get('code');
}
async function redeemCode(code, extra = {}) {
  return httpPost('/oauth2/token', {
    grant_type: 'authorization_code', code,
    redirect_uri: 'http://localhost:8080/callback',
    client_id: 'test-client', client_secret: 'test-secret', ...extra,
  });
}
function encodeBase64Url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function insertRow(sql, params) {
  return new Promise((res, rej) => {
    const db = new Database('data.db');
    db.run(sql, params, (err) => { db.close(); err ? rej(err) : res(); });
  });
}

// ── 1. PKCE S256 end-to-end ─────────────────────────────────────────────────
console.log('\n[1] PKCE S256 end-to-end');
const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const codeChallenge = encodeBase64Url(createHash('sha256').update(codeVerifier).digest());

// 1a – GET renders form with hidden fields
{
  const url = `/oauth2/authorize?client_id=test-client&redirect_uri=http://localhost:8080/callback&response_type=code&scope=openid&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  const r = await httpGet(url);
  const html = await r.text();
  if (r.status !== 200) fail('1a GET renders form', `status ${r.status}`);
  else if (!html.includes('name="code_challenge"')) fail('1a', 'code_challenge hidden field missing');
  else if (!html.includes(codeChallenge)) fail('1a', 'challenge value not in form');
  else pass('1a GET renders form with code_challenge hidden field');
}

// 1b – POST stores challenge (code is issued)
const pkceCode = await fetchAuthCode({ challenge: codeChallenge, method: 'S256' });
if (!pkceCode) fail('1b POST stores code_challenge', 'no code returned');
else pass('1b POST /oauth2/authorize issued code with PKCE params');

// 1c – correct verifier succeeds
{
  const code = await fetchAuthCode({ challenge: codeChallenge, method: 'S256' });
  const r = await redeemCode(code, { code_verifier: codeVerifier });
  const j = await r.json();
  if (r.status !== 200 || !j.access_token) fail('1c correct verifier', `${r.status} ${JSON.stringify(j)}`);
  else pass('1c correct code_verifier -> 200 with tokens');
}

// 1d – wrong verifier -> 400 invalid_grant
{
  const code = await fetchAuthCode({ challenge: codeChallenge, method: 'S256' });
  const r = await redeemCode(code, { code_verifier: 'wrongverifier' });
  const j = await r.json();
  if (r.status !== 400 || j.error !== 'invalid_grant') fail('1d wrong verifier', `${r.status} ${JSON.stringify(j)}`);
  else pass('1d wrong code_verifier -> 400 invalid_grant');
}

// 1e – missing verifier -> 400 invalid_grant
{
  const r = await redeemCode(pkceCode);
  const j = await r.json();
  if (r.status !== 400 || j.error !== 'invalid_grant') fail('1e missing verifier', `${r.status} ${JSON.stringify(j)}`);
  else pass('1e missing code_verifier -> 400 invalid_grant');
}

// ── 2. S256 algorithm correctness ───────────────────────────────────────────
console.log('\n[2] S256 algorithm correctness (RFC 7636 appendix B)');
{
  const v = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const got = encodeBase64Url(createHash('sha256').update(v).digest());
  if (got !== expected) fail('2 S256', `expected ${expected}, got ${got}`);
  else pass('2 SHA-256 base64url matches RFC 7636 test vector');
}

// ── 3. Single-use codes ──────────────────────────────────────────────────────
console.log('\n[3] Single-use codes');
{
  const code = await fetchAuthCode();
  const r1 = await redeemCode(code);
  if (r1.status !== 200) { fail('3 first exchange', `status ${r1.status}`); }
  else {
    const r2 = await redeemCode(code);
    const j2 = await r2.json();
    if (r2.status !== 400 || j2.error !== 'invalid_grant') fail('3 replay', `${r2.status} ${JSON.stringify(j2)}`);
    else pass('3 replay of used code -> 400 invalid_grant');
  }
}

// ── 4. Auth code expiry ──────────────────────────────────────────────────────
console.log('\n[4] Auth code expiry');
{
  const expiredCode = 'audit-expired-code-' + Date.now();
  await insertRow(
    `INSERT INTO auth_codes (code,client_id,user_id,redirect_uri,scope,expires_at,used)
     VALUES (?,?,?,?,?,?,0)`,
    [expiredCode, 'test-client', 1, 'http://localhost:8080/callback', 'openid',
     Math.floor(Date.now() / 1000) - 1]
  );
  const r = await redeemCode(expiredCode);
  const j = await r.json();
  if (r.status !== 400 || j.error !== 'invalid_grant') fail('4 expired code', `${r.status} ${JSON.stringify(j)}`);
  else pass('4 expired auth code -> 400 invalid_grant');
}

// ── 5. Access token expiry ───────────────────────────────────────────────────
console.log('\n[5] Access token expiry');
{
  const expiredTokenVal = 'audit-expired-at-' + Date.now();
  await insertRow(
    `INSERT INTO tokens (access_token,client_id,user_id,scope,expires_at) VALUES (?,?,?,?,?)`,
    [expiredTokenVal, 'test-client', 1, 'openid', Math.floor(Date.now() / 1000) - 1]
  );
  const r = await httpGet('/userinfo', { Authorization: `Bearer ${expiredTokenVal}` });
  if (r.status !== 401) fail('5 expired access token', `status ${r.status}`);
  else pass('5 expired access token -> 401 at /userinfo');
}

// ── 6. Private key never in responses ───────────────────────────────────────
console.log('\n[6] Private key not in HTTP responses');
{
  const pem = readFileSync('keys/private.pem', 'utf8');
  const keyLine = pem.split('\n').find(l => l.length > 20 && !l.startsWith('---'));
  const toCheck = [
    [await httpGet('/health'),                           'GET /health'],
    [await httpGet('/.well-known/jwks.json'),            'GET /jwks.json'],
    [await httpGet('/.well-known/openid-configuration'), 'GET /openid-config'],
  ];
  let clean = true;
  for (const [r, name] of toCheck) {
    const body = await r.text();
    if (body.includes(keyLine) || body.includes('PRIVATE KEY')) {
      fail(`6 private key in ${name}`, 'PEM material found');
      clean = false;
    }
  }
  if (clean) pass('6 private key absent from all HTTP responses checked');
}

// ── 7. id_token signature verifiable from JWKS ──────────────────────────────
console.log('\n[7] id_token RS256 signature');
{
  const code = await fetchAuthCode();
  const r = await redeemCode(code);
  const { id_token } = await r.json();
  const [hB64, pB64, sB64] = id_token.split('.');
  const header = JSON.parse(Buffer.from(hB64, 'base64url').toString());

  const jwksR = await httpGet('/.well-known/jwks.json');
  const { keys } = await jwksR.json();
  const jwk = keys.find(k => k.kid === header.kid);

  if (!jwk) {
    fail('7 kid match', `header kid "${header.kid}" not found in JWKS`);
  } else {
    const pubKey = createPublicKey({ key: jwk, format: 'jwk' });
    const verify = createVerify('RSA-SHA256');
    verify.update(`${hB64}.${pB64}`);
    const sig = Buffer.from(sB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!verify.verify(pubKey, sig)) fail('7 signature', 'verification failed');
    else pass(`7 id_token RS256 signature valid; kid "${header.kid}" matches JWKS`);
  }
}

// ── 8. Cache-Control: no-store ───────────────────────────────────────────────
console.log('\n[8] Cache-Control: no-store on token endpoint');
{
  const code = await fetchAuthCode();
  const r = await redeemCode(code);
  const cc = r.headers.get('cache-control');
  if (cc !== 'no-store') fail('8 Cache-Control', `got "${cc}"`);
  else pass('8 token endpoint: Cache-Control: no-store');
}

// ── 9. Content-Type: application/json ───────────────────────────────────────
console.log('\n[9] Content-Type: application/json on all JSON endpoints');
{
  const checks = [
    [await httpGet('/health'),                           'GET /health'],
    [await httpGet('/.well-known/jwks.json'),            'GET /jwks.json'],
    [await httpGet('/.well-known/openid-configuration'), 'GET /openid-config'],
    [await httpGet('/oauth2/authorize'),                 'GET /authorize (400)'],
    [await httpPost('/oauth2/token', {}),                'POST /token (401)'],
    [await httpGet('/userinfo'),                         'GET /userinfo (401)'],
    [await httpPost('/userinfo', {}),                    'POST /userinfo (405)'],
  ];
  let allOk = true;
  for (const [r, name] of checks) {
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) { fail(`9 ${name}`, `content-type: "${ct}"`); allOk = false; }
  }
  if (allOk) pass('9 all JSON endpoints set Content-Type: application/json');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(failCount === 0 ? 'All checks passed.' : `${failCount} check(s) FAILED.`);
process.exit(failCount > 0 ? 1 : 0);
