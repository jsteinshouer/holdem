import { describe, expect, it, vi } from "vitest";
import type { TableCommandResponse } from "@friendly-holdem/shared";
import type { Logger } from "./logger.js";
import { createTableStore } from "./tableStore.js";
import { createRealtimeServer, type RealtimeIo, type RealtimeSocket } from "./realtime.js";

const defaults = {
  startingStack: 1000,
  blinds: { smallBlind: 5, bigBlind: 10 },
  disconnectedActionGraceMs: 30000,
  hostAutoFoldAfterMs: 120000,
  eventLogCap: 200
};

type Emitted = { socketId: string; event: string; payload: unknown };

type FakeSocket = RealtimeSocket & {
  joined: string[];
  emit(event: string, ...args: unknown[]): void;
};

function createFakeSocket(id: string): FakeSocket {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const joined: string[] = [];

  return {
    id,
    joined,
    join: (room: string) => {
      joined.push(room);
    },
    on: (event, handler) => {
      handlers.set(event, handler as (...args: unknown[]) => void);
    },
    // Test helper: fire a registered handler as if the client emitted the event.
    emit: (event, ...args) => {
      const handler = handlers.get(event);
      if (!handler) {
        throw new Error(`no handler registered for ${event}`);
      }
      handler(...args);
    }
  };
}

function createFakeIo(): RealtimeIo & { emitted: Emitted[] } {
  const emitted: Emitted[] = [];

  return {
    emitted,
    to: (room: string) => ({
      emit: (event: string, ...args: unknown[]) => {
        emitted.push({ socketId: room, event, payload: args[0] });
      }
    })
  };
}

function createTestLogger(): Logger & { entries: { level: string; message: string }[] } {
  const entries: { level: string; message: string }[] = [];
  return {
    entries,
    info: (message) => entries.push({ level: "info", message }),
    warn: (message) => entries.push({ level: "warn", message }),
    error: (message) => entries.push({ level: "error", message })
  };
}

function setup() {
  let now = 1000;
  const io = createFakeIo();
  const store = createTableStore(defaults, undefined, () => now);
  const logger = createTestLogger();
  const scheduled: string[] = [];
  const realtime = createRealtimeServer({
    io,
    store,
    logger,
    now: () => now,
    // Capture disconnected-actor timers instead of arming real ones.
    setTimer: () => 0 as unknown as ReturnType<typeof setTimeout>,
    clearTimer: () => {},
    // A no-op bot scheduler keeps bot turns out of these transport-level tests.
    createBotScheduler: () => ({
      schedule: (tableId: string) => scheduled.push(tableId),
      rearmRestoredTables: () => {}
    })
  });

  const connect = (id: string): FakeSocket => {
    const socket = createFakeSocket(id);
    realtime.handleConnection(socket);
    return socket;
  };

  const createTable = (id: string, displayName: string) => {
    const socket = connect(id);
    const reply = vi.fn();
    socket.emit("table:create", { displayName }, reply);
    const response = reply.mock.calls[0]![0] as Extract<TableCommandResponse, { ok: true }>;
    return { socket, response, tableId: response.snapshot.tableId };
  };

  return { realtime, io, store, logger, scheduled, connect, createTable, setNow: (value: number) => (now = value) };
}

describe("realtime server", () => {
  it("creates a table, joins the socket to the room, and acknowledges the caller", () => {
    const { io, store, createTable } = setup();

    const { socket, response, tableId } = createTable("sock-host", "Host");

    expect(response.ok).toBe(true);
    expect(socket.joined).toContain(tableId);
    expect(store.getTableIds()).toEqual([tableId]);
    // Creating a table does not broadcast — only state-changing commands after do.
    expect(io.emitted).toEqual([]);
  });

  it("broadcasts a per-viewer snapshot to every tracked socket when a player joins", () => {
    const { io, connect, createTable } = setup();
    const { tableId } = createTable("sock-host", "Host");

    const playerSocket = connect("sock-player");
    const joinReply = vi.fn();
    playerSocket.emit("table:join", { tableId, displayName: "Grace" }, joinReply);

    expect((joinReply.mock.calls[0]![0] as TableCommandResponse).ok).toBe(true);
    const snapshotTargets = io.emitted.filter((entry) => entry.event === "table:snapshot").map((entry) => entry.socketId);
    expect(snapshotTargets).toEqual(expect.arrayContaining(["sock-host", "sock-player"]));
  });

  it("rejects a table command from a socket that has not joined the table", () => {
    const { connect } = setup();
    const stranger = connect("sock-stranger");
    const reply = vi.fn();

    stranger.emit("player:action", { tableId: "ghost-table", action: "check" }, reply);

    expect(reply.mock.calls[0]![0]).toEqual({ ok: false, reason: "Join the table before acting." });
  });

  it("rate-limits a socket that floods invalid commands", () => {
    const { connect } = setup();
    const stranger = connect("sock-flood");
    const replies: TableCommandResponse[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reply = vi.fn();
      stranger.emit("hand:start", { tableId: "ghost-table" }, reply);
      replies.push(reply.mock.calls[0]![0] as TableCommandResponse);
    }

    expect(replies[0]).toEqual({ ok: false, reason: "Join the table before starting a hand." });
    expect(replies[4]).toEqual({ ok: false, reason: "Too many invalid commands. Please wait a moment." });
  });

  it("broadcasts a sanitized chat message back to the table", () => {
    const { io, createTable } = setup();
    const { socket, tableId } = createTable("sock-host", "Host");
    io.emitted.length = 0;

    const chatReply = vi.fn();
    socket.emit("chat:send", { tableId, body: "hello table" }, chatReply);

    expect((chatReply.mock.calls[0]![0] as TableCommandResponse).ok).toBe(true);
    expect(io.emitted.some((entry) => entry.event === "table:snapshot" && entry.socketId === "sock-host")).toBe(true);
  });

  it("starts a hand and applies a legal action from the current actor", () => {
    const { store, connect, createTable } = setup();
    const { socket: hostSocket, response: hostResp, tableId } = createTable("sock-host", "Host");
    const playerSocket = connect("sock-player");
    playerSocket.emit("table:join", { tableId, displayName: "Grace" }, vi.fn());

    const startReply = vi.fn();
    hostSocket.emit("hand:start", { tableId }, startReply);
    const started = startReply.mock.calls[0]![0] as Extract<TableCommandResponse, { ok: true }>;
    expect(started.ok).toBe(true);
    expect(started.snapshot.hand.phase).toBe("preflop");

    // Act as whoever the engine says is on the clock, using that actor's own
    // legal-action list so the command is always valid.
    const actorId = store.snapshotFor(tableId, hostResp.snapshot.viewerParticipantId).hand.currentActorId;
    expect(actorId).not.toBeNull();
    const legalActions = store.snapshotFor(tableId, actorId!).hand.legalActions;
    const action = legalActions.includes("check") ? "check" : legalActions.includes("call") ? "call" : legalActions[0];
    const actorSocket = actorId === hostResp.snapshot.viewerParticipantId ? hostSocket : playerSocket;

    const actionReply = vi.fn();
    actorSocket.emit("player:action", { tableId, action }, actionReply);
    expect((actionReply.mock.calls[0]![0] as TableCommandResponse).ok).toBe(true);
  });

  it("marks a fully disconnected participant and untracks its socket", () => {
    const { io, connect, createTable, logger } = setup();
    const { tableId } = createTable("sock-host", "Host");
    const playerSocket = connect("sock-player");
    playerSocket.emit("table:join", { tableId, displayName: "Grace" }, vi.fn());
    io.emitted.length = 0;

    playerSocket.emit("disconnect", "transport close");

    // Disconnect re-broadcasts and logs, then the now-untracked socket is treated
    // as a stranger for any further command.
    expect(io.emitted.some((entry) => entry.event === "table:snapshot")).toBe(true);
    expect(logger.entries.some((entry) => entry.message === "socket disconnected")).toBe(true);

    const afterReply = vi.fn();
    playerSocket.emit("player:action", { tableId, action: "check" }, afterReply);
    expect(afterReply.mock.calls[0]![0]).toEqual({ ok: false, reason: "Join the table before acting." });
  });

  it("keeps a participant connected when only one of its sockets disconnects", () => {
    const { store, connect, createTable } = setup();
    const { response, tableId } = createTable("sock-host", "Host");
    const sessionToken = response.sessionToken;

    // A second socket reconnects to the same host identity (e.g. a second tab).
    const secondSocket = connect("sock-host-2");
    secondSocket.emit("player:reconnect", { tableId, sessionToken }, vi.fn());

    secondSocket.emit("disconnect", "transport close");

    // The host still has socket "sock-host", so it must not be marked disconnected.
    const snapshot = store.snapshotFor(tableId, response.snapshot.viewerParticipantId);
    const host = snapshot.seats
      .map((seat) => seat.player)
      .find((player) => player?.id === response.snapshot.viewerParticipantId);
    expect(host?.isConnected).toBe(true);
  });
});
