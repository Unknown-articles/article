import { createApp } from "./app.js";
import { initDb } from "./db.js";
import { PORT } from "./config.js";
import { ensureSigningKey } from "./keys.js";

await initDb();
await ensureSigningKey();

const app = createApp();

app.listen(PORT, () => {
  console.log(`OIDC provider listening on http://localhost:${PORT}`);
});
