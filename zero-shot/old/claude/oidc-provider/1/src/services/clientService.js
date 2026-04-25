import { getDb } from '../db/index.js';

export function getClientById(clientId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!row) return null;
  return {
    ...row,
    redirect_uris: JSON.parse(row.redirect_uris),
    scopes: JSON.parse(row.scopes),
  };
}

export function validateRedirectUri(client, redirectUri) {
  return client.redirect_uris.includes(redirectUri);
}

export function validateScopes(client, requestedScope) {
  const requested = requestedScope.trim().split(/\s+/);
  return requested.every((s) => client.scopes.includes(s));
}
