import assert from 'node:assert/strict';
import request from 'supertest';
import { bootstrap } from '../src/bootstrap.js';
import { closeDatabase, removeFileIfExists } from './test-helpers.js';

async function run() {
  const databaseFile = 'data/test-jwks.sqlite';
  await removeFileIfExists(databaseFile);

  const { app, database } = await bootstrap({
    issuer: 'http://127.0.0.1:3200',
    databaseFile,
  });

  try {
    const initialResponse = await request(app)
      .get('/.well-known/jwks.json')
      .expect(200);

    assert.equal(initialResponse.body.keys.length, 1);
    assert.equal(initialResponse.body.keys[0].alg, 'RS256');
    assert.equal(initialResponse.body.keys[0].use, 'sig');
    assert.ok(initialResponse.body.keys[0].kid);

    const previousKid = initialResponse.body.keys[0].kid;

    const rotateResponse = await request(app)
      .post('/oauth2/keys/rotate')
      .expect(201);

    assert.notEqual(rotateResponse.body.kid, previousKid);

    const rotatedResponse = await request(app)
      .get('/.well-known/jwks.json')
      .expect(200);

    assert.equal(rotatedResponse.body.keys.length, 2);
    assert.equal(rotatedResponse.body.keys[0].kid, rotateResponse.body.kid);
    assert.equal(rotatedResponse.body.keys[1].kid, previousKid);

    console.log('jwks.test.js: ok');
  } finally {
    await closeDatabase(database);
  }
}

run().catch((error) => {
  console.error('jwks.test.js: failed');
  console.error(error);
  process.exitCode = 1;
});
