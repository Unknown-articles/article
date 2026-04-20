import path from "node:path";

const DEFAULT_PORT = 3000;
const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";
const DEFAULT_DB_PATH = "./chat.db";

export const config = {
  port: Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN,
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH ?? DEFAULT_DB_PATH),
};
