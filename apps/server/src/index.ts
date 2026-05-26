import { createServer } from "node:http";
import type {
  CreateTablePayload,
  JoinTablePayload,
  ReconnectPlayerPayload,
  TableCommandResponse
} from "@friendly-holdem/shared";
import { Server } from "socket.io";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createTableStore } from "./tableStore.js";

const config = loadConfig();
const logger = createLogger("friendly-holdem-server");
const tableStore = createTableStore(config.defaults, config.clientOrigin);
const socketsByParticipant = new Map<string, Set<string>>();
const participantBySocket = new Map<string, { tableId: string; participantId: string }>();
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
  let activeTableId: string | undefined;
  let activeParticipantId: string | undefined;

  socket.on(
    "table:create",
    (payload: CreateTablePayload, reply?: (response: TableCommandResponse) => void) => {
      runTableCommand(reply, () => {
        const response = tableStore.createTable(payload.displayName);
        activeTableId = response.snapshot.tableId;
        activeParticipantId = response.snapshot.viewerParticipantId;
        socket.join(activeTableId);
        trackSocket(socket.id, activeTableId, activeParticipantId);
        logger.info("table created", {
          tableId: activeTableId,
          hostId: activeParticipantId,
          seatedPlayerCount: response.snapshot.seatedPlayerCount
        });
        return response;
      });
    }
  );

  socket.on("table:join", (payload: JoinTablePayload, reply?: (response: TableCommandResponse) => void) => {
    runTableCommand(reply, () => {
      const response = tableStore.joinTable(payload.tableId, payload.displayName, payload.sessionToken);
      activeTableId = response.snapshot.tableId;
      activeParticipantId = response.snapshot.viewerParticipantId;
      socket.join(activeTableId);
      trackSocket(socket.id, activeTableId, activeParticipantId);
      logger.info("participant joined table", {
        tableId: activeTableId,
        participantId: activeParticipantId,
        viewerRole: response.snapshot.viewerRole,
        seatedPlayerCount: response.snapshot.seatedPlayerCount,
        spectatorCount: response.snapshot.spectatorCount
      });
      broadcastSnapshots(activeTableId);
      return response;
    });
  });

  socket.on(
    "player:reconnect",
    (payload: ReconnectPlayerPayload, reply?: (response: TableCommandResponse) => void) => {
      runTableCommand(reply, () => {
        const response = tableStore.reconnectTable(payload.tableId, payload.sessionToken);
        activeTableId = response.snapshot.tableId;
        activeParticipantId = response.snapshot.viewerParticipantId;
        socket.join(activeTableId);
        trackSocket(socket.id, activeTableId, activeParticipantId);
        logger.info("participant reconnected", {
          tableId: activeTableId,
          participantId: activeParticipantId,
          viewerRole: response.snapshot.viewerRole
        });
        broadcastSnapshots(activeTableId);
        return response;
      });
    }
  );

  socket.on("disconnect", (reason) => {
    const activeParticipant = participantBySocket.get(socket.id);

    if (activeParticipant) {
      untrackSocket(socket.id);
      const remainingSockets = socketsByParticipant.get(activeParticipant.participantId);

      if (!remainingSockets || remainingSockets.size === 0) {
        tableStore.disconnectParticipant(activeParticipant.tableId, activeParticipant.participantId);
      }

      broadcastSnapshots(activeParticipant.tableId);
    }

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

function runTableCommand(
  reply: ((response: TableCommandResponse) => void) | undefined,
  command: () => TableCommandResponse
): void {
  try {
    const response = command();
    reply?.(response);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Command failed.";
    reply?.({ ok: false, reason });
  }
}

function broadcastSnapshots(tableId: string): void {
  const table = tableStore.getTable(tableId);

  if (!table) {
    return;
  }

  for (const participant of table.participants.values()) {
    const socketIds = socketsByParticipant.get(participant.id);

    for (const socketId of socketIds ?? []) {
      io.to(socketId).emit("table:snapshot", tableStore.snapshotFor(tableId, participant.id));
    }
  }
}

function trackSocket(socketId: string, tableId: string, participantId: string): void {
  untrackSocket(socketId);
  const socketIds = socketsByParticipant.get(participantId) ?? new Set<string>();

  socketIds.add(socketId);
  socketsByParticipant.set(participantId, socketIds);
  participantBySocket.set(socketId, { tableId, participantId });
}

function untrackSocket(socketId: string): void {
  const tracked = participantBySocket.get(socketId);

  if (!tracked) {
    return;
  }

  const socketIds = socketsByParticipant.get(tracked.participantId);
  socketIds?.delete(socketId);

  if (socketIds?.size === 0) {
    socketsByParticipant.delete(tracked.participantId);
  }

  participantBySocket.delete(socketId);
}
