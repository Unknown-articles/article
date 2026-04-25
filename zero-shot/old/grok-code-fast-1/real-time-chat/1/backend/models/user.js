import db from '../db.js';
import { hashPassword, verifyPassword, generateToken } from '../auth.js';

export const createUser = async (username, password) => {
  const hashedPassword = await hashPassword(password);
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, username });
      }
    });
  });
};

export const findUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

export const authenticateUser = async (username, password) => {
  const user = await findUserByUsername(username);
  if (user && await verifyPassword(password, user.password)) {
    return generateToken(user);
  }
  return null;
};