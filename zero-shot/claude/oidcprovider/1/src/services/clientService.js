import { getDb } from '../db/index.js';

export function getClientById(clientId) {
  const db = getDb();
  return db.prepare('SELECT * FROM clients WHERE client_id = ?').get(clientId);
}

export function validateRedirectUri(client, redirectUri) {
  const uris = JSON.parse(client.redirect_uris);
  return uris.includes(redirectUri);
}

export function validateClientSecret(client, secret) {
  return client.client_secret === secret;
}
