import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { bootstrap } from '../src/bootstrap.js';
import { closeDatabase, removeFileIfExists } from './test-helpers.js';

function createPkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

async function run() {
  const databaseFile = 'data/test-userinfo.sqlite';
  await removeFileIfExists(databaseFile);

  const { app, database } = await bootstrap({
    issuer: 'http://127.0.0.1:3500',
    databaseFile,
  });

  try {
    const codeVerifier = 'userinfo-verifier-value-1234567890';
    const codeChallenge = createPkceChallenge(codeVerifier);

    const authorizationResponse = await request(app)
      .get('/oauth2/authorize')
      .query({
        response_type: 'code',
        client_id: 'oidc-client',
        redirect_uri: 'http://127.0.0.1:4000/callback',
        scope: 'openid profile email',
        login_hint: 'alice@example.com',
        password: 'password123',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      })
      .expect(200);

    const tokenResponse = await request(app)
      .post('/oauth2/token')
      .send({
        grant_type: 'authorization_code',
        code: authorizationResponse.body.code,
        client_id: 'oidc-client',
        redirect_uri: 'http://127.0.0.1:4000/callback',
        code_verifier: codeVerifier,
      })
      .expect(200);

    const userinfoResponse = await request(app)
      .get('/userinfo')
      .set('Authorization', `Bearer ${tokenResponse.body.access_token}`)
      .expect(200);

    assert.equal(userinfoResponse.body.sub, 'user-123');
    assert.equal(userinfoResponse.body.email, 'alice@example.com');
    assert.equal(userinfoResponse.body.name, 'Alice Example');
    assert.equal(userinfoResponse.body.email_verified, true);

    const invalidTokenResponse = await request(app)
      .get('/userinfo')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    assert.equal(invalidTokenResponse.body.error, 'invalid_token');

    console.log('userinfo.test.js: ok');
  } finally {
    await closeDatabase(database);
  }
}

run().catch((error) => {
  console.error('userinfo.test.js: failed');
  console.error(error);
  process.exitCode = 1;
});
