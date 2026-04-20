import { get } from '../database/db.js';

export async function findClientById(database, clientId) {
  const row = await get(database, 'SELECT * FROM clients WHERE client_id = ?', [clientId]);
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    redirectUris: JSON.parse(row.redirect_uris),
    grants: JSON.parse(row.grants),
    responseTypes: JSON.parse(row.response_types),
    scopes: JSON.parse(row.scopes),
  };
}
