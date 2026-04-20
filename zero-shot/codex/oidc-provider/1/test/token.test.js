import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { decodeJwt } from 'jose';
import { bootstrap } from '../src/bootstrap.js';
import { closeDatabase, removeFileIfExists } from './test-helpers.js';

function createPkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

async function run() {
  const databaseFile = 'data/test-token.sqlite';
  await removeFileIfExists(databaseFile);

  const { app, database } = await bootstrap({
    issuer: 'http://127.0.0.1:3400',
    databaseFile,
  });

  try {
    const codeVerifier = 'verifier-value-for-pkce-1234567890';
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

    assert.equal(tokenResponse.body.token_type, 'Bearer');
    assert.equal(tokenResponse.body.expires_in, 3600);
    assert.ok(tokenResponse.body.access_token);
    assert.ok(tokenResponse.body.id_token);

    const decodedIdToken = decodeJwt(tokenResponse.body.id_token);
    assert.equal(decodedIdToken.iss, 'http://127.0.0.1:3400');
    assert.equal(decodedIdToken.sub, 'user-123');
    assert.equal(decodedIdToken.aud, 'oidc-client');
    assert.equal(decodedIdToken.email, 'alice@example.com');

    const invalidPkceResponse = await request(app)
      .post('/oauth2/token')
      .send({
        grant_type: 'authorization_code',
        code: authorizationResponse.body.code,
        client_id: 'oidc-client',
        redirect_uri: 'http://127.0.0.1:4000/callback',
        code_verifier: 'wrong-verifier',
      })
      .expect(400);

    assert.equal(invalidPkceResponse.body.error, 'invalid_grant');

    console.log('token.test.js: ok');
  } finally {
    await closeDatabase(database);
  }
}

run().catch((error) => {
  console.error('token.test.js: failed');
  console.error(error);
  process.exitCode = 1;
});
