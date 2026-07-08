import { createServer, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createActiveTablePersistence } from "./activeTablePersistence.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createTableStore } from "./tableStore.js";
import { createRealtimeServer } from "./realtime.js";

const config = loadConfig();
const logger = createLogger("friendly-holdem-server");
const activeTablePersistence = createActiveTablePersistence(config.activeTablePersistence, logger);
const expiredActiveTableIds = activeTablePersistence?.deleteExpiredTables(Date.now()) ?? [];
const tableStore = createTableStore(config.defaults, config.clientOrigin, Date.now, activeTablePersistence);
const staticClientDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../client/dist");
const staticClientAvailable = existsSync(join(staticClientDir, "index.html"));
const httpServer = createServer((request, response) => {
  if (request.url?.startsWith("/socket.io/")) {
    return;
  }

  if (request.url === "/healthz" || !staticClientAvailable) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "friendly-holdem-server" }));
    return;
  }

  serveStaticClient(request.url ?? "/", response);
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

function serveStaticClient(requestUrl: string, response: ServerResponse): void {
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  const requestedPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = safeStaticPath(requestedPath);
  const existingFilePath = filePath && isFile(filePath) ? filePath : join(staticClientDir, "index.html");

  response.writeHead(200, { "content-type": contentTypeFor(existingFilePath) });
  createReadStream(existingFilePath).pipe(response);
}

function safeStaticPath(pathname: string): string | null {
  const filePath = resolve(staticClientDir, normalize(pathname));

  return filePath.startsWith(`${staticClientDir}${sep}`) ? filePath : null;
}

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function contentTypeFor(filePath: string): string {
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8"
  };

  return contentTypes[extname(filePath)] ?? "application/octet-stream";
}
