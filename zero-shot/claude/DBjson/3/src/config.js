module.exports = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || './data.json',
  jwtSecret: process.env.JWT_SECRET || 'dynamic-api-secret-change-in-production',
  jwtExpiry: '24h',
  bcryptRounds: 10,
};
