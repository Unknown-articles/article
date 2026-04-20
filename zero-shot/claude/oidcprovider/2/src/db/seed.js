export function seedDatabase(db) {
  const existingClient = db.prepare('SELECT id FROM clients WHERE client_id = ?').get('test-client');
  if (!existingClient) {
    db.prepare(`
      INSERT INTO clients (client_id, client_secret, redirect_uris)
      VALUES (?, ?, ?)
    `).run(
      'test-client',
      'test-secret',
      JSON.stringify(['http://localhost:8080/callback', 'http://localhost:3000/callback'])
    );
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('testuser');
  if (!existingUser) {
    db.prepare(`
      INSERT INTO users (username, password, email, name)
      VALUES (?, ?, ?, ?)
    `).run('testuser', 'password123', 'testuser@example.com', 'Test User');
  }
}
