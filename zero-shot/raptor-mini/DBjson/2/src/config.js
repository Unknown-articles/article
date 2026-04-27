const path = require('path');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.resolve(__dirname, '../data/db.json'),
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  tokenTtl: '1h',
  reservedCollections: ['_users', '_teams']
};
