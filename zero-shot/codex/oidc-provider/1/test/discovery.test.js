import assert from 'node:assert/strict';
import request from 'supertest';
import { bootstrap } from '../src/bootstrap.js';
import { closeDatabase, removeFileIfExists } from './test-helpers.js';

async function run() {
  const databaseFile = 'data/test-discovery.sqlite';
  await removeFileIfExists(databaseFile);

  const { app, database } = await bootstrap({
    issuer: 'http://127.0.0.1:3100',
    databaseFile,
  });

  try {
    const response = await request(app)
      .get('/.well-known/openid-configuration')
      .expect(200);

    assert.equal(response.body.issuer, 'http://127.0.0.1:3100');
    assert.equal(response.body.authorization_endpoint, 'http://127.0.0.1:3100/oauth2/authorize');
    assert.equal(response.body.token_endpoint, 'http://127.0.0.1:3100/oauth2/token');
    assert.equal(response.body.userinfo_endpoint, 'http://127.0.0.1:3100/userinfo');
    assert.equal(response.body.jwks_uri, 'http://127.0.0.1:3100/.well-known/jwks.json');
    assert.deepEqual(response.body.response_types_supported, ['code']);
    assert.deepEqual(response.body.subject_types_supported, ['public']);
    assert.deepEqual(response.body.id_token_signing_alg_values_supported, ['RS256']);

    console.log('discovery.test.js: ok');
  } finally {
    await closeDatabase(database);
  }
}

run().catch((error) => {
  console.error('discovery.test.js: failed');
  console.error(error);
  process.exitCode = 1;
});
