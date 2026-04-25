import app from './app.js';
import config from './config/index.js';

app.listen(config.PORT, () => {
  console.log(`OIDC Provider running on port ${config.PORT}`);
  console.log(`Issuer: ${config.ISSUER}`);
});
