import { createServer, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AddBotPayload,
  ApproveRebuyPayload,
  CreateTablePayload,
  DealNextHandPayload,
  HostAutoFoldInactivePayload,
  JoinTablePayload,
  PlayerActionPayload,
  ReconnectPlayerPayload,
  RejoinPayload,
  RemovePlayerPayload,
  SeatSpectatorPayload,
  SendChatMessagePayload,
  SitOutPayload,
  StartHandPayload,
  TableCommandResponse
} from "@friendly-holdem/shared";
import { Server } from "socket.io";
import { createActiveTablePersistence } from "./activeTablePersistence.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createTableStore } from "./tableStore.js";
import { createBotActionScheduler } from "./botScheduler.js";

const config = loadConfig();
const logger = createLogger("friendly-holdem-server");
const activeTablePersistence = createActiveTablePersistence(config.activeTablePersistence, logger);
const expiredActiveTableIds = activeTablePersistence?.deleteExpiredTables(Date.now()) ?? [];
const tableStore = createTableStore(config.defaults, config.clientOrigin, Date.now, activeTablePersistence);
const socketsByParticipant = new Map<string, Set<string>>();
const participantBySocket = new Map<string, { tableId: string; participantId: string }>();
const disconnectedActionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const botActionScheduler = createBotActionScheduler({
  store: tableStore,
  onBotActed: (tableId, response) => {
    logger.info("bot acted", {
      tableId,
      participantId: response.snapshot.viewerParticipantId,
      phase: response.snapshot.hand.phase
    });
    broadcastSnapshots(tableId);
    scheduleDisconnectedAutoAction(tableId);
  }
});
const rejectedCommandTimestampsBySocket = new Map<string, number[]>();
const INVALID_COMMAND_RATE_LIMIT_WINDOW_MS = 10_000;
const INVALID_COMMAND_RATE_LIMIT_MAX = 4;
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

io.on("connection", (socket) => {
  logger.info("socket connected", { socketId: socket.id });
  let activeTableId: string | undefined;
  let activeParticipantId: string | undefined;
  const runSocketTableCommand = (
    reply: ((response: TableCommandResponse) => void) | undefined,
    command: () => TableCommandResponse
  ) => runTableCommand(reply, command, socket.id);

  socket.on(
    "table:create",
    (payload: CreateTablePayload, reply?: (response: TableCommandResponse) => void) => {
      runSocketTableCommand(reply, () => {
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
    runSocketTableCommand(reply, () => {
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
      scheduleDisconnectedAutoAction(activeTableId);
      return response;
    });
  });

  socket.on(
    "player:reconnect",
    (payload: ReconnectPlayerPayload, reply?: (response: TableCommandResponse) => void) => {
      runSocketTableCommand(reply, () => {
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
        scheduleDisconnectedAutoAction(activeTableId);
        return response;
      });
    }
  );

  socket.on("hand:start", (payload: StartHandPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before starting a hand.");
      }

      const response = tableStore.startHand(payload.tableId, participant.participantId);
      logger.info("hand started", {
        tableId: payload.tableId,
        participantId: participant.participantId,
        seatedPlayerCount: response.snapshot.seatedPlayerCount,
        phase: response.snapshot.hand.phase
      });
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on("hand:next", (payload: DealNextHandPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before dealing the next hand.");
      }

      const response = tableStore.dealNextHand(payload.tableId, participant.participantId);
      logger.info("next hand dealt", {
        tableId: payload.tableId,
        participantId: participant.participantId,
        handNumber: response.snapshot.hand.handNumber,
        phase: response.snapshot.hand.phase
      });
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on("player:action", (payload: PlayerActionPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before acting.");
      }

      const response = tableStore.playerAction(
        payload.tableId,
        participant.participantId,
        payload.action,
        payload.raiseTo
      );
      logger.info("player action", {
        tableId: payload.tableId,
        participantId: participant.participantId,
        action: payload.action,
        phase: response.snapshot.hand.phase
      });
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on("player:sitOut", (payload: SitOutPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before sitting out.");
      }

      const response = tableStore.sitOut(payload.tableId, participant.participantId);
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on("player:rejoin", (payload: RejoinPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before rejoining.");
      }

      const response = tableStore.rejoin(payload.tableId, participant.participantId);
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on("host:approveRebuy", (payload: ApproveRebuyPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before approving a rebuy.");
      }

      const response = tableStore.approveRebuy(payload.tableId, participant.participantId, payload.participantId);
      logger.info("rebuy approved", {
        tableId: payload.tableId,
        hostId: participant.participantId,
        participantId: payload.participantId
      });
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on("host:seatSpectator", (payload: SeatSpectatorPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before seating a spectator.");
      }

      const response = tableStore.seatSpectator(payload.tableId, participant.participantId, payload.participantId);
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on("host:removePlayer", (payload: RemovePlayerPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before removing a player.");
      }

      const response = tableStore.removePlayer(payload.tableId, participant.participantId, payload.participantId);
      logger.info("inactive player removed", {
        tableId: payload.tableId,
        hostId: participant.participantId,
        participantId: payload.participantId
      });
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on("host:addBot", (payload: AddBotPayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before adding a bot.");
      }

      const response = tableStore.addBot(payload.tableId, participant.participantId);
      logger.info("bot added", {
        tableId: payload.tableId,
        hostId: participant.participantId,
        seatedPlayerCount: response.snapshot.seatedPlayerCount
      });
      broadcastSnapshots(payload.tableId);
      scheduleDisconnectedAutoAction(payload.tableId);
      return response;
    });
  });

  socket.on(
    "host:autoFoldInactive",
    (payload: HostAutoFoldInactivePayload, reply?: (response: TableCommandResponse) => void) => {
      runSocketTableCommand(reply, () => {
        const participant = participantBySocket.get(socket.id);

        if (!participant || participant.tableId !== payload.tableId) {
          throw new Error("Join the table before auto-folding an inactive player.");
        }

        const response = tableStore.hostAutoFoldInactive(payload.tableId, participant.participantId);
        logger.info("inactive player auto-folded by host", {
          tableId: payload.tableId,
          hostId: participant.participantId
        });
        broadcastSnapshots(payload.tableId);
        scheduleDisconnectedAutoAction(payload.tableId);
        return response;
      });
    }
  );

  socket.on("chat:send", (payload: SendChatMessagePayload, reply?: (response: TableCommandResponse) => void) => {
    runSocketTableCommand(reply, () => {
      const participant = participantBySocket.get(socket.id);

      if (!participant || participant.tableId !== payload.tableId) {
        throw new Error("Join the table before chatting.");
      }

      const response = tableStore.sendChatMessage(payload.tableId, participant.participantId, payload.body);
      broadcastSnapshots(payload.tableId);
      return response;
    });
  });

  socket.on("disconnect", (reason) => {
    const activeParticipant = participantBySocket.get(socket.id);

    if (activeParticipant) {
      untrackSocket(socket.id);
      const remainingSockets = socketsByParticipant.get(activeParticipant.participantId);

      if (!remainingSockets || remainingSockets.size === 0) {
        tableStore.disconnectParticipant(activeParticipant.tableId, activeParticipant.participantId);
      }

      broadcastSnapshots(activeParticipant.tableId);
      scheduleDisconnectedAutoAction(activeParticipant.tableId);
    }

    logger.info("socket disconnected", { socketId: socket.id, reason });
  });
});

httpServer.listen(config.port, () => {
  for (const tableId of tableStore.getTableIds()) {
    scheduleDisconnectedAutoAction(tableId);
  }

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

function runTableCommand(
  reply: ((response: TableCommandResponse) => void) | undefined,
  command: () => TableCommandResponse,
  socketId?: string
): void {
  try {
    const response = command();
    reply?.(response);
  } catch (error) {
    const reason =
      socketId && isInvalidCommandRateLimited(socketId)
        ? "Too many invalid commands. Please wait a moment."
        : error instanceof Error
          ? error.message
          : "Command failed.";
    logger.warn("command rejected", { socketId, reason });
    reply?.({ ok: false, reason });
  }
}

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

function isInvalidCommandRateLimited(socketId: string): boolean {
  const nowMs = Date.now();
  const recentTimestamps = (rejectedCommandTimestampsBySocket.get(socketId) ?? []).filter(
    (timestamp) => nowMs - timestamp < INVALID_COMMAND_RATE_LIMIT_WINDOW_MS
  );

  recentTimestamps.push(nowMs);
  rejectedCommandTimestampsBySocket.set(socketId, recentTimestamps);

  return recentTimestamps.length > INVALID_COMMAND_RATE_LIMIT_MAX;
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

function scheduleDisconnectedAutoAction(tableId: string): void {
  // Bots and disconnected players share the same re-arm points, so the bot-turn
  // scheduler rides along with every call that reconsiders the current actor.
  botActionScheduler.schedule(tableId);

  const existingTimer = disconnectedActionTimers.get(tableId);

  if (existingTimer) {
    clearTimeout(existingTimer);
    disconnectedActionTimers.delete(tableId);
  }

  const table = tableStore.getTable(tableId);
  const hand = table?.hand;

  if (!table || !hand || hand.currentActorSeat === null || hand.currentActorSince === null) {
    return;
  }

  const actor = [...table.participants.values()].find(
    (participant) => participant.seatNumber === hand.currentActorSeat
  );
  const handState = actor ? hand.participants.get(actor.id) : undefined;

  if (!actor || actor.isConnected || handState?.isAllIn) {
    return;
  }

  const elapsedMs = Date.now() - hand.currentActorSince;
  const remainingMs = Math.max(0, table.defaults.disconnectedActionGraceMs - elapsedMs);
  const timer = setTimeout(() => {
    disconnectedActionTimers.delete(tableId);
    const response = tableStore.autoActDisconnectedCurrentActor(tableId);

    if (response) {
      logger.info("disconnected player auto-acted", {
        tableId,
        participantId: response.snapshot.viewerParticipantId,
        phase: response.snapshot.hand.phase
      });
      broadcastSnapshots(tableId);
    }

    scheduleDisconnectedAutoAction(tableId);
  }, remainingMs);

  disconnectedActionTimers.set(tableId, timer);
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
