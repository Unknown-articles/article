import { seedClient } from '../constants/clients.js';
import { seedUser } from '../constants/users.js';
import { all, get, run } from './sqlite.js';

export async function seedDatabase() {
  const existingUser = await get(
    'SELECT id FROM users WHERE username = ?',
    [seedUser.username],
  );

  if (!existingUser) {
    await run(
      `INSERT INTO users (sub, username, password, email, name)
       VALUES (?, ?, ?, ?, ?)`,
      [
        seedUser.sub,
        seedUser.username,
        seedUser.password,
        seedUser.email,
        seedUser.name,
      ],
    );
  }

  let client = await get(
    'SELECT id FROM clients WHERE client_id = ?',
    [seedClient.clientId],
  );

  if (!client) {
    const result = await run(
      'INSERT INTO clients (client_id, client_secret) VALUES (?, ?)',
      [seedClient.clientId, seedClient.clientSecret],
    );

    client = { id: result.lastID };
  }

  const storedRedirectUris = await all(
    'SELECT redirect_uri FROM client_redirect_uris WHERE client_id = ?',
    [client.id],
  );
  const storedSet = new Set(storedRedirectUris.map((row) => row.redirect_uri));

  for (const redirectUri of seedClient.redirectUris) {
    if (!storedSet.has(redirectUri)) {
      await run(
        'INSERT INTO client_redirect_uris (client_id, redirect_uri) VALUES (?, ?)',
        [client.id, redirectUri],
      );
    }
  }
}
