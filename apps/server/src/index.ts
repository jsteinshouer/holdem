import { createServer } from "node:http";
import { Server } from "socket.io";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";

const config = loadConfig();
const logger = createLogger("friendly-holdem-server");
const httpServer = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, service: "friendly-holdem-server" }));
});

const io = new Server(httpServer, {
  cors: {
    origin: config.clientOrigin
  }
});

io.on("connection", (socket) => {
  logger.info("socket connected", { socketId: socket.id });

  socket.on("disconnect", (reason) => {
    logger.info("socket disconnected", { socketId: socket.id, reason });
  });
});

httpServer.listen(config.port, () => {
  logger.info("server started", {
    port: config.port,
    clientOrigin: config.clientOrigin,
    defaultStartingStack: config.defaults.startingStack,
    defaultSmallBlind: config.defaults.blinds.smallBlind,
    defaultBigBlind: config.defaults.blinds.bigBlind,
    disconnectedActionGraceMs: config.defaults.disconnectedActionGraceMs,
    hostAutoFoldAfterMs: config.defaults.hostAutoFoldAfterMs,
    eventLogCap: config.defaults.eventLogCap
  });
});
