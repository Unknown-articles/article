import { get, run } from './db.js';

const DEFAULT_USER = {
  subject: 'user-123',
  email: 'alice@example.com',
  name: 'Alice Example',
  password: 'password123',
};

const DEFAULT_CLIENT = {
  clientId: 'oidc-client',
  clientSecret: 'super-secret-client',
  redirectUris: JSON.stringify(['http://127.0.0.1:4000/callback']),
  grants: JSON.stringify(['authorization_code']),
  responseTypes: JSON.stringify(['code']),
  scopes: JSON.stringify(['openid', 'profile', 'email']),
};

export async function seedDatabase(database) {
  const existingUser = await get(database, 'SELECT id FROM users WHERE subject = ?', [DEFAULT_USER.subject]);
  if (!existingUser) {
    await run(
      database,
      'INSERT INTO users (subject, email, name, password) VALUES (?, ?, ?, ?)',
      [DEFAULT_USER.subject, DEFAULT_USER.email, DEFAULT_USER.name, DEFAULT_USER.password],
    );
  }

  const existingClient = await get(database, 'SELECT id FROM clients WHERE client_id = ?', [DEFAULT_CLIENT.clientId]);
  if (!existingClient) {
    await run(
      database,
      `
        INSERT INTO clients (client_id, client_secret, redirect_uris, grants, response_types, scopes)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        DEFAULT_CLIENT.clientId,
        DEFAULT_CLIENT.clientSecret,
        DEFAULT_CLIENT.redirectUris,
        DEFAULT_CLIENT.grants,
        DEFAULT_CLIENT.responseTypes,
        DEFAULT_CLIENT.scopes,
      ],
    );
  }
}
