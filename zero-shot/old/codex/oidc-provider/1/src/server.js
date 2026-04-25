import { bootstrap } from './bootstrap.js';

const { app, config } = await bootstrap();

app.listen(config.port, () => {
  console.log(`OIDC provider listening on ${config.issuer}`);
});
