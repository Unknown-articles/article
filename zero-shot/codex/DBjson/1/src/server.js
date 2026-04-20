const { createApp } = require("./app");
const { PORT, DATA_FILE } = require("./config");
const { FileStore } = require("./db/fileStore");
const { AuthService } = require("./services/authService");
const { DataService } = require("./services/dataService");

async function start() {
  const store = new FileStore(DATA_FILE);
  await store.initialize();

  const authService = new AuthService(store);
  const dataService = new DataService(store);
  const app = createApp({ dataService, authService });

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
