const PORT = process.env.PORT || 3000;
const ISSUER = process.env.ISSUER || `http://localhost:${PORT}`;

export default {
  PORT,
  ISSUER,
  DB_PATH: process.env.DB_PATH || ':memory:',
  ACCESS_TOKEN_TTL: 3600,
  AUTH_CODE_TTL: 600,
};
