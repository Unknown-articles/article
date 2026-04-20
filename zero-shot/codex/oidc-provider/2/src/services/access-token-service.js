import { get } from '../db/sqlite.js';

export async function findAccessToken(accessToken) {
  return get(
    `SELECT
       t.id,
       t.access_token,
       t.scope,
       t.expires_at,
       c.client_id,
       u.sub,
       u.email,
       u.name
     FROM tokens t
     INNER JOIN clients c ON c.id = t.client_id
     INNER JOIN users u ON u.id = t.user_id
     WHERE t.access_token = ?`,
    [accessToken],
  );
}
