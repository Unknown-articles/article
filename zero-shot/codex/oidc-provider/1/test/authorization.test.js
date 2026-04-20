import assert from 'node:assert/strict';
import request from 'supertest';
import { bootstrap } from '../src/bootstrap.js';
import { closeDatabase, removeFileIfExists } from './test-helpers.js';

async function run() {
  const databaseFile = 'data/test-authorization.sqlite';
  await removeFileIfExists(databaseFile);

  const { app, database } = await bootstrap({
    issuer: 'http://127.0.0.1:3300',
    databaseFile,
  });

  try {
    const response = await request(app)
      .get('/oauth2/authorize')
      .query({
        response_type: 'code',
        client_id: 'oidc-client',
        redirect_uri: 'http://127.0.0.1:4000/callback',
        scope: 'openid profile email',
        state: 'abc123',
        login_hint: 'alice@example.com',
        password: 'password123',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
      })
      .expect(200);

    assert.ok(response.body.code);
    assert.equal(response.body.state, 'abc123');
    assert.match(response.body.redirect_to, /code=/);

    const invalidScopeResponse = await request(app)
      .get('/oauth2/authorize')
      .query({
        response_type: 'code',
        client_id: 'oidc-client',
        redirect_uri: 'http://127.0.0.1:4000/callback',
        scope: 'profile',
        login_hint: 'alice@example.com',
        password: 'password123',
      })
      .expect(400);

    assert.equal(invalidScopeResponse.body.error, 'invalid_scope');

    console.log('authorization.test.js: ok');
  } finally {
    await closeDatabase(database);
  }
}

run().catch((error) => {
  console.error('authorization.test.js: failed');
  console.error(error);
  process.exitCode = 1;
});
