const express = require("express");
const { createAuthRouter } = require("./auth");
const { JsonDatabase } = require("./db");
const { createResourceRouter } = require("./resources");

const app = express();
const port = Number(process.env.PORT || 3000);
const db = new JsonDatabase(process.env.DB_PATH);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", createAuthRouter(db));
app.use(createResourceRouter(db));

db.init()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
