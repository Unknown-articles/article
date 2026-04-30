const express = require("express");
const { createAuthMiddleware, createAuthRouter } = require("./auth");
const { createResourceRouter } = require("./resources");
const { JsonStore } = require("./storage");
const { createTeamsRouter } = require("./teams");

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH;

async function main() {
  const store = new JsonStore(DB_PATH);
  await store.init();

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  const requireAuth = createAuthMiddleware(store);

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", createAuthRouter(store, requireAuth));
  app.use("/auth/teams", createTeamsRouter(store, requireAuth));
  app.use("/", createResourceRouter(store, requireAuth));

  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    return next(err);
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
