import { get } from '../database/db.js';

export async function authenticateUser(database, email, password) {
  const user = await get(
    database,
    'SELECT id, subject, email, name FROM users WHERE email = ? AND password = ?',
    [email, password],
  );

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    subject: user.subject,
    email: user.email,
    name: user.name,
  };
}

export async function findUserById(database, id) {
  const user = await get(
    database,
    'SELECT id, subject, email, name FROM users WHERE id = ?',
    [id],
  );

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    subject: user.subject,
    email: user.email,
    name: user.name,
  };
}
