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
import { createBotActionScheduler, type BotScheduler, type BotSchedulerDeps } from "./botScheduler.js";
import type { Logger } from "./logger.js";
import type { TableStore } from "./tableStore.js";

// Minimal structural views of the Socket.IO server/socket the realtime layer
// needs. Keeping them narrow lets the connection handler be driven by a fake
// socket in unit tests without binding a port or pulling in socket.io-client.
export type RealtimeIo = {
  to(room: string): { emit(event: string, ...args: unknown[]): void };
};

export type RealtimeSocket = {
  id: string;
  join(room: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): void;
};

export type RealtimeServerDeps = {
  io: RealtimeIo;
  store: TableStore;
  logger: Logger;
  now?: () => number;
  setTimer?: (handler: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  createBotScheduler?: (deps: BotSchedulerDeps) => BotScheduler;
};

export type RealtimeServer = {
  handleConnection(socket: RealtimeSocket): void;
  broadcastSnapshots(tableId: string): void;
  scheduleDisconnectedAutoAction(tableId: string): void;
  rearmActiveTables(): void;
};

const INVALID_COMMAND_RATE_LIMIT_WINDOW_MS = 10_000;
const INVALID_COMMAND_RATE_LIMIT_MAX = 4;

export function createRealtimeServer(deps: RealtimeServerDeps): RealtimeServer {
  const {
    io,
    store,
    logger,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    createBotScheduler = createBotActionScheduler
  } = deps;

  const socketsByParticipant = new Map<string, Set<string>>();
  const participantBySocket = new Map<string, { tableId: string; participantId: string }>();
  const disconnectedActionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const rejectedCommandTimestampsBySocket = new Map<string, number[]>();

  const botActionScheduler = createBotScheduler({
    store,
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

  function handleConnection(socket: RealtimeSocket): void {
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
          const response = store.createTable(payload.displayName);
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
        const response = store.joinTable(payload.tableId, payload.displayName, payload.sessionToken);
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
          const response = store.reconnectTable(payload.tableId, payload.sessionToken);
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

        const response = store.startHand(payload.tableId, participant.participantId);
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

        const response = store.dealNextHand(payload.tableId, participant.participantId);
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

        const response = store.playerAction(
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

        const response = store.sitOut(payload.tableId, participant.participantId);
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

        const response = store.rejoin(payload.tableId, participant.participantId);
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

        const response = store.approveRebuy(payload.tableId, participant.participantId, payload.participantId);
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

        const response = store.seatSpectator(payload.tableId, participant.participantId, payload.participantId);
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

        const response = store.removePlayer(payload.tableId, participant.participantId, payload.participantId);
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

        const response = store.addBot(payload.tableId, participant.participantId);
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

          const response = store.hostAutoFoldInactive(payload.tableId, participant.participantId);
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

        const response = store.sendChatMessage(payload.tableId, participant.participantId, payload.body);
        broadcastSnapshots(payload.tableId);
        return response;
      });
    });

    socket.on("disconnect", (reason: string) => {
      const activeParticipant = participantBySocket.get(socket.id);

      if (activeParticipant) {
        untrackSocket(socket.id);
        const remainingSockets = socketsByParticipant.get(activeParticipant.participantId);

        if (!remainingSockets || remainingSockets.size === 0) {
          store.disconnectParticipant(activeParticipant.tableId, activeParticipant.participantId);
        }

        broadcastSnapshots(activeParticipant.tableId);
        scheduleDisconnectedAutoAction(activeParticipant.tableId);
      }

      logger.info("socket disconnected", { socketId: socket.id, reason });
    });

    void activeTableId;
    void activeParticipantId;
  }

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

  function isInvalidCommandRateLimited(socketId: string): boolean {
    const nowMs = now();
    const recentTimestamps = (rejectedCommandTimestampsBySocket.get(socketId) ?? []).filter(
      (timestamp) => nowMs - timestamp < INVALID_COMMAND_RATE_LIMIT_WINDOW_MS
    );

    recentTimestamps.push(nowMs);
    rejectedCommandTimestampsBySocket.set(socketId, recentTimestamps);

    return recentTimestamps.length > INVALID_COMMAND_RATE_LIMIT_MAX;
  }

  function broadcastSnapshots(tableId: string): void {
    const table = store.getTable(tableId);

    if (!table) {
      return;
    }

    for (const participant of table.participants.values()) {
      const socketIds = socketsByParticipant.get(participant.id);

      for (const socketId of socketIds ?? []) {
        io.to(socketId).emit("table:snapshot", store.snapshotFor(tableId, participant.id));
      }
    }
  }

  function scheduleDisconnectedAutoAction(tableId: string): void {
    // Bots and disconnected players share the same re-arm points, so the bot-turn
    // scheduler rides along with every call that reconsiders the current actor.
    botActionScheduler.schedule(tableId);

    const existingTimer = disconnectedActionTimers.get(tableId);

    if (existingTimer) {
      clearTimer(existingTimer);
      disconnectedActionTimers.delete(tableId);
    }

    const table = store.getTable(tableId);
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

    const elapsedMs = now() - hand.currentActorSince;
    const remainingMs = Math.max(0, table.defaults.disconnectedActionGraceMs - elapsedMs);
    const timer = setTimer(() => {
      disconnectedActionTimers.delete(tableId);
      const response = store.autoActDisconnectedCurrentActor(tableId);

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

  function rearmActiveTables(): void {
    for (const tableId of store.getTableIds()) {
      scheduleDisconnectedAutoAction(tableId);
    }
  }

  return { handleConnection, broadcastSnapshots, scheduleDisconnectedAutoAction, rearmActiveTables };
}
