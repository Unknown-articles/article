import { all, get } from '../db/sqlite.js';

export async function findClientByClientId(clientId) {
  const client = await get(
    'SELECT id, client_id, client_secret FROM clients WHERE client_id = ?',
    [clientId],
  );

  if (!client) {
    return null;
  }

  const redirectUris = await all(
    'SELECT redirect_uri FROM client_redirect_uris WHERE client_id = ? ORDER BY id ASC',
    [client.id],
  );

  return {
    ...client,
    redirect_uris: redirectUris.map((row) => row.redirect_uri),
  };
}
