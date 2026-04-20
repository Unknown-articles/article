import { createResourceMonitorServer } from "./create-server.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const resourceMonitor = await createResourceMonitorServer();
await resourceMonitor.listen(port);

console.log(`Resource Monitor API listening on port ${port}`);
