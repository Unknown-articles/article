const path = require("node:path");
const { createApp } = require("./app");

const port = Number(process.env.PORT || 3000);
const dataFile = process.env.DATA_FILE || path.join(process.cwd(), "data", "db.json");
const app = createApp({ dataFile, jwtSecret: process.env.JWT_SECRET || "dev-secret" });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
