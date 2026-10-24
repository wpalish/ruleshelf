import { createServer } from "./core/server.js";
import definition from "./module.js";
const port = Number(process.env.PORT || 8792),
  origin = process.env.PUBLIC_ORIGIN || "http://127.0.0.1:" + port;
const { server } = createServer(definition, {
  database: process.env.DATABASE_PATH || ".data/workspace.sqlite",
  origin,
  admin: process.env.WORK_ADMIN_PASSWORD
    ? {
        username: process.env.WORK_ADMIN_USER || "admin",
        password: process.env.WORK_ADMIN_PASSWORD,
      }
    : undefined,
});
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(definition.title + ": " + origin),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());
