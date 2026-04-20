import db from '../db.js';

export const saveMessage = (userId, username, content) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO messages (userId, username, content) VALUES (?, ?, ?)', [userId, username, content], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, userId, username, content, timestamp: new Date() });
      }
    });
  });
};

export const getMessages = (limit = 50) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.reverse());
      }
    });
  });
};