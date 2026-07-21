import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createActiveTablePersistence } from "./activeTablePersistence.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createTableStore } from "./tableStore.js";
import { createRealtimeServer } from "./realtime.js";
import { createStaticFileHandler } from "./staticFileHandler.js";

const config = loadConfig();
const logger = createLogger("friendly-holdem-server");

// Last-resort safety net: a bug that escapes a request handler or a rejected
// promise must not silently take down the single always-on server for everyone.
// Log it and stay up; per-request errors are already handled where they occur.
process.on("uncaughtException", (error) => {
  logger.error("uncaught exception", { error: error instanceof Error ? error.stack ?? error.message : String(error) });
});
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection", {
    reason: reason instanceof Error ? reason.stack ?? reason.message : String(reason)
  });
});
const activeTablePersistence = createActiveTablePersistence(config.activeTablePersistence, logger);
const expiredActiveTableIds = activeTablePersistence?.deleteExpiredTables(Date.now()) ?? [];
const tableStore = createTableStore(config.defaults, config.clientOrigin, Date.now, activeTablePersistence);
const staticClientDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../client/dist");
const staticClientAvailable = existsSync(join(staticClientDir, "index.html"));
const staticFileHandler = createStaticFileHandler({ staticClientDir });
const httpServer = createServer((request, response) => {
  if (request.url?.startsWith("/socket.io/")) {
    return;
  }

  if (request.url === "/healthz" || !staticClientAvailable) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "friendly-holdem-server" }));
    return;
  }

  staticFileHandler.serveStaticClient(request.url ?? "/", response);
});

const io = new Server(httpServer, {
  cors: {
    origin: config.clientCorsOrigins
  }
});

const realtime = createRealtimeServer({ io, store: tableStore, logger });

io.on("connection", (socket) => {
  realtime.handleConnection(socket);
});

httpServer.listen(config.port, () => {
  realtime.rearmActiveTables();

  logger.info("server started", {
    port: config.port,
    clientOrigin: config.clientOrigin,
    clientCorsOrigins: config.clientCorsOrigins.join(","),
    staticClientDir,
    staticClientAvailable,
    defaultStartingStack: config.defaults.startingStack,
    defaultSmallBlind: config.defaults.blinds.smallBlind,
    defaultBigBlind: config.defaults.blinds.bigBlind,
    disconnectedActionGraceMs: config.defaults.disconnectedActionGraceMs,
    hostAutoFoldAfterMs: config.defaults.hostAutoFoldAfterMs,
    eventLogCap: config.defaults.eventLogCap,
    activeTablePersistence: config.activeTablePersistence.mode,
    activeTableInactivityTtlMs: config.activeTablePersistence.inactivityTtlMs,
    restoredActiveTableCount: tableStore.getTableIds().length,
    expiredActiveTableCount: expiredActiveTableIds.length
  });
});
