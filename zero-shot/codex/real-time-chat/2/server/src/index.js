import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachChatServer } from "./chat.js";
import { config } from "./config.js";
import { initializeDatabase } from "./db.js";

async function start() {
  await initializeDatabase();

  const app = createApp();
  const server = createServer(app);
  attachChatServer(server);

  server.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
