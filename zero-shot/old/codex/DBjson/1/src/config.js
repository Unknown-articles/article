const path = require("path");

const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), "data", "db.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const PORT = Number(process.env.PORT || 3000);

module.exports = {
  DATA_FILE,
  JWT_SECRET,
  PORT,
};
