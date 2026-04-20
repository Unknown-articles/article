const config = {
  port: process.env.PORT || 3000,
  issuer: process.env.ISSUER || 'http://localhost:3000',
  dbPath: process.env.DB_PATH || './data/oidc.db',
  accessTokenExpiresIn: 3600,  // seconds (1 hour)
  authCodeExpiresIn: 600,       // seconds (10 minutes)
};

export default config;
