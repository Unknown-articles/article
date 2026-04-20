import app from './app.js';
import config from './config/index.js';
import { initializeSchema, seedData } from './db/schema.js';
import { getActiveSigningKey } from './crypto/keys.js';

async function start() {
  // Bootstrap database
  initializeSchema();
  seedData();

  // Ensure at least one RSA signing key exists before accepting traffic
  await getActiveSigningKey();

  app.listen(config.port, () => {
    console.log(`\nOIDC Provider listening on port ${config.port}`);
    console.log(`Issuer:        ${config.issuer}`);
    console.log(`Discovery:     ${config.issuer}/.well-known/openid-configuration`);
    console.log(`JWKS:          ${config.issuer}/.well-known/jwks.json`);
    console.log(`Authorize:     ${config.issuer}/oauth2/authorize`);
    console.log(`Token:         ${config.issuer}/oauth2/token`);
    console.log(`UserInfo:      ${config.issuer}/userinfo\n`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
