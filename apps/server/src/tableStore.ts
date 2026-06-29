import { randomBytes } from "node:crypto";
import type {
  Card,
  CardRank,
  CardSuit,
  ChatMessage,
  HandSnapshot,
  LegalAction,
  TableDefaults,
  TableSnapshot,
  TableSessionResponse,
  ViewerRole
} from "@friendly-holdem/shared";
import { ACTIVE_TABLE_SCHEMA_VERSION, type ActiveTablePersistencePort } from "./activeTablePersistence.js";
import { simpleBotStrategy, type BotDecision, type BotStrategy } from "./botStrategy.js";

const MAX_SEATS = 6;
const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_CHAT_MESSAGE_LENGTH = 180;
const CHAT_RATE_LIMIT_MS = 1500;
const BOT_NAMES = ["Bluffy", "Chip", "Maverick", "Ace", "Rounder", "Sleeves"];

type ParticipantKind = "player" | "spectator";

export type Participant = {
  id: string;
  displayName: string;
  sessionToken: string;
  kind: ParticipantKind;
  seatNumber: number | null;
  stack: number;
  isSittingOut: boolean;
  isConnected: boolean;
  isBot: boolean;
  botStrategyId: string | null;
  lastChatSentAt: number | null;
};

type HandParticipantState = {
  participantId: string;
  seatNumber: number;
  holeCards: Card[];
  currentBet: number;
  totalCommitted: number;
  hasFolded: boolean;
  hasActed: boolean;
  isAllIn: boolean;
};

type ActiveHand = {
  handNumber: number;
  phase: "preflop" | "flop" | "turn" | "river" | "showdown" | "settled";
  deck: Card[];
  board: Card[];
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentActorSeat: number | null;
  currentActorSince: number | null;
  participants: Map<string, HandParticipantState>;
  pot: number;
  currentBet: number;
  minimumRaiseIncrement: number;
  actionLog: string[];
  settlementSummary: string | null;
  shouldRevealHoleCards: boolean;
};

type HandEvaluator = {
  evaluate(cards: Card[]): HandScore;
};

export type PrivateTable = {
  id: string;
  hostId: string;
  participants: Map<string, Participant>;
  participantIdsByToken: Map<string, string>;
  hasHandStarted: boolean;
  hand: ActiveHand | null;
  chatMessages: ChatMessage[];
  defaults: TableDefaults;
};

export type SerializedActiveTableState = {
  schemaVersion: typeof ACTIVE_TABLE_SCHEMA_VERSION;
  table: {
    id: string;
    hostId: string;
    participants: Participant[];
    hasHandStarted: boolean;
    hand: SerializedActiveHand | null;
    chatMessages: ChatMessage[];
    defaults: TableDefaults;
  };
};

export type SerializedActiveHand = Omit<ActiveHand, "participants"> & {
  participants: HandParticipantState[];
};

export type TableStore = ReturnType<typeof createTableStore>;

export function createTableStore(
  defaults: TableDefaults,
  origin?: string,
  now: () => number = Date.now,
  persistence?: ActiveTablePersistencePort | null,
  random: () => number = Math.random,
  botStrategy: BotStrategy = simpleBotStrategy
) {
  const tables = new Map<string, PrivateTable>();

  if (persistence) {
    restorePersistedTables(tables, defaults, persistence, now);
  }

  function createTable(displayName: string): TableSessionResponse {
    const tableId = createUniqueId(tables);
    const host = createParticipant(displayName, "player", 0, defaults.startingStack);
    const table: PrivateTable = {
      id: tableId,
      hostId: host.id,
      participants: new Map([[host.id, host]]),
      participantIdsByToken: new Map([[host.sessionToken, host.id]]),
      hasHandStarted: false,
      hand: null,
      chatMessages: [],
      defaults
    };

    tables.set(table.id, table);
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: host.sessionToken,
      snapshot: createSnapshot(table, host.id, origin, now)
    };
  }

  function joinTable(tableId: string, displayName: string, sessionToken?: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);

    if (sessionToken) {
      const reconnected = reconnectParticipant(table, sessionToken);

      if (reconnected) {
        persistTable(table, persistence, now);

        return {
          ok: true,
          sessionToken: reconnected.sessionToken,
          snapshot: createSnapshot(table, reconnected.id, origin, now)
        };
      }
    }

    const seatNumber = nextOpenSeat(table);
    const participant =
      !table.hasHandStarted && seatNumber !== null
        ? createParticipant(displayName, "player", seatNumber, defaults.startingStack)
        : createParticipant(displayName, "spectator", null, defaults.startingStack);

    table.participants.set(participant.id, participant);
    table.participantIdsByToken.set(participant.sessionToken, participant.id);
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin, now)
    };
  }

  function reconnectTable(tableId: string, sessionToken: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = reconnectParticipant(table, sessionToken);

    if (!participant) {
      throw new Error("Session was not found for this table.");
    }

    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin, now)
    };
  }

  function disconnectParticipant(tableId: string, participantId: string): void {
    const table = tables.get(tableId);
    const participant = table?.participants.get(participantId);

    if (participant) {
      participant.isConnected = false;

      if (table && isBetweenHands(table) && participant.kind === "player" && participant.seatNumber !== null) {
        participant.isSittingOut = true;
      }
    }
  }

  function snapshotFor(tableId: string, participantId: string): TableSnapshot {
    return createSnapshot(getExistingTable(tables, tableId), participantId, origin, now);
  }

  function startHand(tableId: string, participantId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = table.participants.get(participantId);

    if (!participant) {
      throw new Error("Participant was not found for this table.");
    }

    if (participant.id !== table.hostId) {
      throw new Error("Only the host can start a hand.");
    }

    if (table.hand) {
      throw new Error("A hand is already in progress.");
    }

    const activePlayers = seatedPlayers(table);

    if (activePlayers.length < 2) {
      throw new Error("At least two seated players are required to start a hand.");
    }

    table.hand = createHand(table, activePlayers, null, now);
    table.hasHandStarted = true;
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin, now)
    };
  }

  function dealNextHand(tableId: string, participantId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = requireParticipant(table, participantId);

    requireHost(table, participant);

    if (!table.hand || table.hand.phase !== "settled") {
      throw new Error("The next hand can only be dealt after settlement.");
    }

    markBustedPlayersSittingOut(table);
    const activePlayers = seatedPlayers(table);

    if (activePlayers.length < 2) {
      throw new Error("At least two active seated players are required to deal the next hand.");
    }

    table.hand = createHand(table, activePlayers, table.hand, now);
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin, now)
    };
  }

  function playerAction(
    tableId: string,
    participantId: string,
    action: LegalAction,
    raiseTo?: number
  ): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = table.participants.get(participantId);
    const hand = table.hand;

    if (!participant) {
      throw new Error("Participant was not found for this table.");
    }

    if (!hand || hand.phase === "settled") {
      throw new Error("There is no active hand.");
    }

    if (participant.kind !== "player" || participant.seatNumber !== hand.currentActorSeat) {
      throw new Error("It is not your turn.");
    }

    applyPlayerAction(table, hand, participant, now, action, raiseTo);
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin, now)
    };
  }

  function autoActDisconnectedCurrentActor(tableId: string): TableSessionResponse | null {
    const table = getExistingTable(tables, tableId);
    const hand = table.hand;
    const actor = currentActor(table);

    if (!hand || !actor || actor.isConnected || !hasCurrentActorWaited(hand, table.defaults.disconnectedActionGraceMs, now)) {
      return null;
    }

    const handState = hand.participants.get(actor.id);

    if (!handState || handState.isAllIn) {
      return null;
    }

    const callAmount = Math.max(0, hand.currentBet - handState.currentBet);
    const action: LegalAction = callAmount === 0 ? "check" : "fold";

    applyPlayerAction(table, hand, actor, now, action);
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: actor.sessionToken,
      snapshot: createSnapshot(table, actor.id, origin, now)
    };
  }

  function hostAutoFoldInactive(tableId: string, hostParticipantId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const host = requireParticipant(table, hostParticipantId);
    const hand = table.hand;
    const actor = currentActor(table);

    requireHost(table, host);

    if (!hand || !actor) {
      throw new Error("There is no current actor to auto-fold.");
    }

    const handState = hand.participants.get(actor.id);

    if (!handState || handState.isAllIn) {
      throw new Error("An all-in player cannot be auto-folded.");
    }

    if (actor.isBot) {
      throw new Error("Bots act on their own and cannot be auto-folded.");
    }

    if (!actor.isConnected) {
      throw new Error("Disconnected players are handled by the grace timer.");
    }

    if (!hasCurrentActorWaited(hand, table.defaults.hostAutoFoldAfterMs, now)) {
      throw new Error("The current actor has not been inactive long enough.");
    }

    applyPlayerAction(table, hand, actor, now, "fold");
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: host.sessionToken,
      snapshot: createSnapshot(table, host.id, origin, now)
    };
  }

  function sitOut(tableId: string, participantId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = requireParticipant(table, participantId);

    requireBetweenHands(table);

    if (participant.kind !== "player" || participant.seatNumber === null) {
      throw new Error("Only seated players can sit out.");
    }

    participant.isSittingOut = true;
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin, now)
    };
  }

  function rejoin(tableId: string, participantId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = requireParticipant(table, participantId);

    requireBetweenHands(table);

    if (participant.kind !== "player" || participant.seatNumber === null) {
      throw new Error("Only seated players can rejoin.");
    }

    if (participant.stack <= 0) {
      throw new Error("A busted player needs a rebuy before rejoining.");
    }

    participant.isSittingOut = false;
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin, now)
    };
  }

  function approveRebuy(tableId: string, hostParticipantId: string, targetParticipantId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const host = requireParticipant(table, hostParticipantId);
    const target = requireParticipant(table, targetParticipantId);

    requireHost(table, host);
    requireBetweenHands(table);

    if (target.kind !== "player" || target.seatNumber === null) {
      throw new Error("Only seated players can receive a rebuy.");
    }

    if (target.stack > 0 && !target.isSittingOut) {
      throw new Error("Only busted or sitting-out players can receive a rebuy.");
    }

    target.stack = table.defaults.startingStack;
    target.isSittingOut = false;
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: host.sessionToken,
      snapshot: createSnapshot(table, host.id, origin, now)
    };
  }

  function seatSpectator(tableId: string, hostParticipantId: string, spectatorId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const host = requireParticipant(table, hostParticipantId);
    const spectator = requireParticipant(table, spectatorId);
    const seatNumber = nextOpenSeat(table);

    requireHost(table, host);
    requireBetweenHands(table);

    if (spectator.kind !== "spectator") {
      throw new Error("Only spectators can be seated.");
    }

    if (seatNumber === null) {
      throw new Error("No open seats are available.");
    }

    spectator.kind = "player";
    spectator.seatNumber = seatNumber;
    spectator.stack = table.defaults.startingStack;
    spectator.isSittingOut = false;
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: host.sessionToken,
      snapshot: createSnapshot(table, host.id, origin, now)
    };
  }

  function removePlayer(tableId: string, hostParticipantId: string, targetParticipantId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const host = requireParticipant(table, hostParticipantId);
    const target = requireParticipant(table, targetParticipantId);

    requireHost(table, host);
    requireBetweenHands(table);

    if (target.id === table.hostId) {
      throw new Error("The host cannot be removed.");
    }

    if (target.kind !== "player" || target.seatNumber === null || target.isConnected) {
      throw new Error("Only inactive seated players can be removed.");
    }

    table.participants.delete(target.id);
    table.participantIdsByToken.delete(target.sessionToken);
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: host.sessionToken,
      snapshot: createSnapshot(table, host.id, origin, now)
    };
  }

  function addBot(tableId: string, hostParticipantId: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const host = requireParticipant(table, hostParticipantId);
    const seatNumber = nextOpenSeat(table);

    requireHost(table, host);
    requireBetweenHands(table);

    if (seatNumber === null) {
      throw new Error("No open seats are available.");
    }

    const bot = createBotParticipant(table, seatNumber, table.defaults.startingStack, botStrategy);

    table.participants.set(bot.id, bot);
    table.participantIdsByToken.set(bot.sessionToken, bot.id);
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: host.sessionToken,
      snapshot: createSnapshot(table, host.id, origin, now)
    };
  }

  function botActionForCurrentActor(tableId: string): TableSessionResponse | null {
    const table = getExistingTable(tables, tableId);
    const hand = table.hand;
    const actor = currentActor(table);

    if (!hand || hand.phase === "settled" || !actor || !actor.isBot) {
      return null;
    }

    // At least one connected human must be present for play to advance.
    if (!hasConnectedHuman(table)) {
      return null;
    }

    const handState = hand.participants.get(actor.id);

    if (!handState || handState.hasFolded || handState.isAllIn) {
      return null;
    }

    const decision = decideBotAction(table, hand, actor, botStrategy, random);

    applyPlayerAction(table, hand, actor, now, decision.action, decision.raiseTo);
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: actor.sessionToken,
      snapshot: createSnapshot(table, actor.id, origin, now)
    };
  }

  function sendChatMessage(tableId: string, participantId: string, body: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = requireParticipant(table, participantId);
    const nowMs = now();

    if (participant.lastChatSentAt !== null && nowMs - participant.lastChatSentAt < CHAT_RATE_LIMIT_MS) {
      throw new Error("Chat is moving too fast. Please wait a moment.");
    }

    const normalizedBody = normalizeChatBody(body);
    participant.lastChatSentAt = nowMs;
    table.chatMessages.push({
      id: randomToken(12),
      participantId: participant.id,
      displayName: participant.displayName,
      body: escapeHtml(normalizedBody),
      sentAt: new Date(nowMs).toISOString()
    });

    if (table.chatMessages.length > table.defaults.eventLogCap) {
      table.chatMessages.splice(0, table.chatMessages.length - table.defaults.eventLogCap);
    }
    persistTable(table, persistence, now);

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin, now)
    };
  }

  function getTable(tableId: string): PrivateTable | undefined {
    return tables.get(tableId);
  }

  function getTableIds(): string[] {
    return [...tables.keys()];
  }

  return {
    createTable,
    joinTable,
    reconnectTable,
    disconnectParticipant,
    snapshotFor,
    startHand,
    dealNextHand,
    playerAction,
    autoActDisconnectedCurrentActor,
    hostAutoFoldInactive,
    sitOut,
    rejoin,
    approveRebuy,
    seatSpectator,
    removePlayer,
    addBot,
    botActionForCurrentActor,
    sendChatMessage,
    getTable,
    getTableIds
  };
}

export function hasConnectedHuman(table: PrivateTable): boolean {
  return [...table.participants.values()].some((participant) => !participant.isBot && participant.isConnected);
}

function decideBotAction(
  table: PrivateTable,
  hand: ActiveHand,
  bot: Participant,
  botStrategy: BotStrategy,
  random: () => number
): BotDecision {
  const handState = hand.participants.get(bot.id);

  if (!handState) {
    throw new Error("Bot was not dealt into the hand.");
  }

  const callAmount = Math.max(0, hand.currentBet - handState.currentBet);
  const legalActions = legalActionsFor(bot, callAmount, hand);
  const contestingStates = activeHandStates(hand);
  const playersYetToAct = contestingStates.filter(
    (state) => state.participantId !== bot.id && !state.isAllIn && !state.hasActed
  ).length;

  const decision = botStrategy.decide({
    holeCards: handState.holeCards,
    board: hand.board,
    legalActions,
    callAmount,
    pot: hand.pot,
    currentBet: hand.currentBet,
    viewerBet: handState.currentBet,
    minimumRaiseTo: hand.currentBet + hand.minimumRaiseIncrement,
    stack: bot.stack,
    activePlayerCount: contestingStates.length,
    playersYetToAct,
    random
  });

  return sanitizeBotDecision(decision, legalActions);
}

// Falls back to a guaranteed-legal action so a bot can never stall the table
// with an action the engine would reject.
function sanitizeBotDecision(decision: BotDecision, legalActions: LegalAction[]): BotDecision {
  if (decision.action === "raise") {
    if (legalActions.includes("raise") && typeof decision.raiseTo === "number") {
      return decision;
    }

    return safeFallbackDecision(legalActions);
  }

  if (legalActions.includes(decision.action)) {
    return { action: decision.action };
  }

  return safeFallbackDecision(legalActions);
}

function safeFallbackDecision(legalActions: LegalAction[]): BotDecision {
  for (const action of ["check", "call", "fold", "all-in"] as const) {
    if (legalActions.includes(action)) {
      return { action };
    }
  }

  return { action: "fold" };
}

function restorePersistedTables(
  tables: Map<string, PrivateTable>,
  defaults: TableDefaults,
  persistence: ActiveTablePersistencePort,
  now: () => number
): void {
  for (const record of persistence.loadActiveTables(now())) {
    try {
      const table = deserializeTable(record.state, defaults);

      if (record.tableId !== table.id || record.schemaVersion !== ACTIVE_TABLE_SCHEMA_VERSION) {
        throw new Error("unsupported active table persistence schema version");
      }

      tables.set(table.id, table);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "invalid persisted active table state";
      persistence.quarantineTable(record.tableId, reason);
    }
  }
}

function persistTable(
  table: PrivateTable,
  persistence: ActiveTablePersistencePort | null | undefined,
  now: () => number
): void {
  if (!persistence) {
    return;
  }

  const nowMs = now();
  persistence.saveTable({
    tableId: table.id,
    schemaVersion: ACTIVE_TABLE_SCHEMA_VERSION,
    lastActivityAt: nowMs,
    updatedAt: nowMs,
    state: serializeTable(table)
  });
}

function serializeTable(table: PrivateTable): SerializedActiveTableState {
  return {
    schemaVersion: ACTIVE_TABLE_SCHEMA_VERSION,
    table: {
      id: table.id,
      hostId: table.hostId,
      participants: [...table.participants.values()].map((participant) => ({ ...participant })),
      hasHandStarted: table.hasHandStarted,
      hand: table.hand
        ? {
            ...table.hand,
            deck: [...table.hand.deck],
            board: [...table.hand.board],
            participants: [...table.hand.participants.values()].map((participant) => ({
              ...participant,
              holeCards: [...participant.holeCards]
            })),
            actionLog: [...table.hand.actionLog]
          }
        : null,
      chatMessages: table.chatMessages.map((message) => ({ ...message })),
      defaults: table.defaults
    }
  };
}

function deserializeTable(state: SerializedActiveTableState, defaults: TableDefaults): PrivateTable {
  assertActiveTableState(state);

  const participants = new Map(
    state.table.participants.map((participant) => [
      participant.id,
      {
        ...participant,
        isBot: participant.isBot === true,
        botStrategyId: participant.botStrategyId ?? null,
        // Bots have no socket, so they stay connected across a restart while
        // humans reconnect with their session tokens.
        isConnected: participant.isBot === true
      }
    ])
  );

  if (!participants.has(state.table.hostId)) {
    throw new Error("persisted active table host was not found");
  }

  return {
    id: state.table.id,
    hostId: state.table.hostId,
    participants,
    participantIdsByToken: new Map(state.table.participants.map((participant) => [participant.sessionToken, participant.id])),
    hasHandStarted: state.table.hasHandStarted,
    hand: state.table.hand
      ? {
          ...state.table.hand,
          deck: [...state.table.hand.deck],
          board: [...state.table.hand.board],
          participants: new Map(
            state.table.hand.participants.map((participant) => [
              participant.participantId,
              {
                ...participant,
                holeCards: [...participant.holeCards]
              }
            ])
          ),
          actionLog: [...state.table.hand.actionLog]
        }
      : null,
    chatMessages: state.table.chatMessages.map((message) => ({ ...message })),
    defaults: state.table.defaults ?? defaults
  };
}

function assertActiveTableState(value: SerializedActiveTableState): void {
  if (!isRecord(value) || value.schemaVersion !== ACTIVE_TABLE_SCHEMA_VERSION || !isRecord(value.table)) {
    throw new Error("unsupported active table persistence schema version");
  }

  const table = value.table;

  if (
    typeof table.id !== "string" ||
    typeof table.hostId !== "string" ||
    !Array.isArray(table.participants) ||
    typeof table.hasHandStarted !== "boolean" ||
    !Array.isArray(table.chatMessages)
  ) {
    throw new Error("invalid persisted active table state");
  }

  for (const participant of table.participants) {
    assertParticipant(participant);
  }

  if (table.hand !== null) {
    assertActiveHand(table.hand);
  }
}

function assertParticipant(value: Participant): void {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.displayName !== "string" ||
    typeof value.sessionToken !== "string" ||
    (value.kind !== "player" && value.kind !== "spectator") ||
    (typeof value.seatNumber !== "number" && value.seatNumber !== null) ||
    typeof value.stack !== "number" ||
    typeof value.isSittingOut !== "boolean" ||
    typeof value.isConnected !== "boolean" ||
    (value.isBot !== undefined && typeof value.isBot !== "boolean") ||
    (value.botStrategyId !== undefined && value.botStrategyId !== null && typeof value.botStrategyId !== "string") ||
    (typeof value.lastChatSentAt !== "number" && value.lastChatSentAt !== null)
  ) {
    throw new Error("invalid persisted participant state");
  }
}

function assertActiveHand(value: SerializedActiveHand): void {
  if (
    !isRecord(value) ||
    !["preflop", "flop", "turn", "river", "showdown", "settled"].includes(String(value.phase)) ||
    typeof value.handNumber !== "number" ||
    !Array.isArray(value.deck) ||
    !Array.isArray(value.board) ||
    typeof value.buttonSeat !== "number" ||
    typeof value.smallBlindSeat !== "number" ||
    typeof value.bigBlindSeat !== "number" ||
    (typeof value.currentActorSeat !== "number" && value.currentActorSeat !== null) ||
    (typeof value.currentActorSince !== "number" && value.currentActorSince !== null) ||
    !Array.isArray(value.participants) ||
    typeof value.pot !== "number" ||
    typeof value.currentBet !== "number" ||
    typeof value.minimumRaiseIncrement !== "number" ||
    !Array.isArray(value.actionLog) ||
    (typeof value.settlementSummary !== "string" && value.settlementSummary !== null) ||
    typeof value.shouldRevealHoleCards !== "boolean"
  ) {
    throw new Error("invalid persisted hand state");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createParticipant(
  displayName: string,
  kind: ParticipantKind,
  seatNumber: number | null,
  stack: number,
  bot: { isBot: boolean; botStrategyId: string | null } = { isBot: false, botStrategyId: null }
): Participant {
  return {
    id: randomToken(16),
    displayName: normalizeDisplayName(displayName),
    sessionToken: randomToken(32),
    kind,
    seatNumber,
    stack,
    isSittingOut: false,
    isConnected: true,
    isBot: bot.isBot,
    botStrategyId: bot.botStrategyId,
    lastChatSentAt: null
  };
}

function createBotParticipant(table: PrivateTable, seatNumber: number, stack: number, strategy: BotStrategy): Participant {
  return createParticipant(pickBotName(table), "player", seatNumber, stack, {
    isBot: true,
    botStrategyId: strategy.id
  });
}

function pickBotName(table: PrivateTable): string {
  const usedNames = new Set([...table.participants.values()].map((participant) => participant.displayName));
  const availableName = BOT_NAMES.find((name) => !usedNames.has(name));

  if (availableName) {
    return availableName;
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${BOT_NAMES[0]} ${suffix}`;

    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }
}

function createSnapshot(
  table: PrivateTable,
  viewerParticipantId: string,
  origin: string | undefined,
  now: () => number
): TableSnapshot {
  const viewer = table.participants.get(viewerParticipantId);

  if (!viewer) {
    throw new Error("Viewer was not found for this table.");
  }

  const viewerRole: ViewerRole =
    viewer.id === table.hostId ? "host" : viewer.kind === "player" ? "player" : "spectator";
  const seats = Array.from({ length: MAX_SEATS }, (_, seatNumber) => {
    const player =
      [...table.participants.values()].find(
        (participant) => participant.kind === "player" && participant.seatNumber === seatNumber
      ) ?? null;

    return {
      seatNumber,
      player: player ? summarizeSeatPlayer(player, table, now) : null
    };
  });
  const spectators = [...table.participants.values()]
    .filter((participant) => participant.kind === "spectator")
    .map((participant) => summarizeParticipant(participant, table.hostId));
  const invitePath = `/table/${table.id}`;

  return {
    tableId: table.id,
    viewerRole,
    viewerParticipantId,
    hostId: table.hostId,
    isHost: viewer.id === table.hostId,
    invitePath,
    ...(origin ? { inviteUrl: new URL(invitePath, origin).toString() } : {}),
    seats,
    spectators,
    seatedPlayerCount: seats.filter((seat) => seat.player).length,
    spectatorCount: spectators.length,
    chatMessages: table.chatMessages,
    hasHandStarted: table.hasHandStarted,
    hand: createHandSnapshot(table, viewer),
    availableControls: {
      canStartHand: viewer.id === table.hostId && !table.hand && seats.filter((seat) => seat.player).length >= 2,
      canDealNextHand:
        viewer.id === table.hostId && table.hand?.phase === "settled" && seatedPlayers(table).length >= 2,
      canSeatSpectators:
        viewer.id === table.hostId && isBetweenHands(table) && spectators.length > 0 && nextOpenSeat(table) !== null,
      canSitOut:
        viewer.kind === "player" &&
        viewer.seatNumber !== null &&
        !viewer.isSittingOut &&
        isBetweenHands(table),
      canRejoin:
        viewer.kind === "player" &&
        viewer.seatNumber !== null &&
        viewer.isSittingOut &&
        viewer.stack > 0 &&
        isBetweenHands(table),
      canHostAutoFoldInactive: canHostAutoFoldInactive(table, viewer, now),
      canAddBot: viewer.id === table.hostId && isBetweenHands(table) && nextOpenSeat(table) !== null
    },
    defaults: table.defaults
  };
}

function createHand(
  table: PrivateTable,
  activePlayers: Participant[],
  previousHand: ActiveHand | null,
  now: () => number
): ActiveHand {
  const deck = shuffleDeck(createDeck());
  const buttonSeat = previousHand ? nextActiveSeat(activePlayers, previousHand.buttonSeat) : activePlayers[0]?.seatNumber ?? 0;
  const smallBlindSeat = activePlayers.length === 2 ? buttonSeat : nextActiveSeat(activePlayers, buttonSeat);
  const bigBlindSeat = nextActiveSeat(activePlayers, smallBlindSeat);
  const currentActorSeat = nextActiveSeat(activePlayers, bigBlindSeat);
  const handParticipants = new Map<string, HandParticipantState>();

  for (const player of activePlayers) {
    const holeCards = [drawCard(deck), drawCard(deck)];
    handParticipants.set(player.id, {
      participantId: player.id,
      seatNumber: player.seatNumber ?? 0,
      holeCards,
      currentBet: 0,
      totalCommitted: 0,
      hasFolded: false,
      hasActed: false,
      isAllIn: false
    });
  }

  const smallBlindPlayer = activePlayers.find((player) => player.seatNumber === smallBlindSeat);
  const bigBlindPlayer = activePlayers.find((player) => player.seatNumber === bigBlindSeat);

  if (!smallBlindPlayer || !bigBlindPlayer) {
    throw new Error("Blind players were not found.");
  }

  const smallBlindAmount = postBlind(smallBlindPlayer, handParticipants, table.defaults.blinds.smallBlind);
  const bigBlindAmount = postBlind(bigBlindPlayer, handParticipants, table.defaults.blinds.bigBlind);

  return {
    handNumber: previousHand ? previousHand.handNumber + 1 : 1,
    phase: "preflop",
    deck,
    board: [],
    buttonSeat,
    smallBlindSeat,
    bigBlindSeat,
    currentActorSeat,
    currentActorSince: now(),
    participants: handParticipants,
    pot: smallBlindAmount + bigBlindAmount,
    currentBet: Math.max(smallBlindAmount, bigBlindAmount),
    minimumRaiseIncrement: table.defaults.blinds.bigBlind,
    actionLog: [
      `${smallBlindPlayer.displayName} posted small blind $${smallBlindAmount}.`,
      `${bigBlindPlayer.displayName} posted big blind $${bigBlindAmount}.`
    ],
    settlementSummary: null,
    shouldRevealHoleCards: false
  };
}

function createHandSnapshot(table: PrivateTable, viewer: Participant): HandSnapshot {
  const hand = table.hand;

  if (!hand) {
    return {
      phase: "waiting",
      handNumber: 0,
      buttonSeat: -1,
      smallBlindSeat: -1,
      bigBlindSeat: -1,
      board: [],
      pot: 0,
      currentBet: 0,
      callAmount: 0,
      currentActorSeat: null,
      currentActorId: null,
      currentActorSince: null,
      legalActions: [],
      viewerHoleCards: [],
      actionLog: [],
      settlementSummary: null
    };
  }

  const viewerHandState = hand.participants.get(viewer.id);
  const currentActor = [...table.participants.values()].find(
    (participant) => participant.seatNumber === hand.currentActorSeat
  );
  const callAmount = viewerHandState ? Math.max(0, hand.currentBet - viewerHandState.currentBet) : 0;

  return {
    phase: hand.phase,
    handNumber: hand.handNumber,
    buttonSeat: hand.buttonSeat,
    smallBlindSeat: hand.smallBlindSeat,
    bigBlindSeat: hand.bigBlindSeat,
    board: hand.board,
    pot: hand.pot,
    currentBet: hand.currentBet,
    callAmount,
    currentActorSeat: hand.currentActorSeat,
    currentActorId: currentActor?.id ?? null,
    currentActorSince: hand.currentActorSince,
    legalActions: viewer.seatNumber === hand.currentActorSeat ? legalActionsFor(viewer, callAmount, hand) : [],
    viewerHoleCards: viewerHandState?.holeCards ?? [],
    actionLog: hand.actionLog,
    settlementSummary: hand.settlementSummary
  };
}

function summarizeSeatPlayer(participant: Participant, table: PrivateTable, now: () => number) {
  const hand = table.hand;
  const handState = hand?.participants.get(participant.id);
  const seatNumber = participant.seatNumber ?? -1;

  return {
    ...summarizeParticipant(participant, table.hostId),
    stack: participant.stack,
    currentBet: handState?.currentBet ?? 0,
    hasCards: Boolean(handState),
    hasFolded: handState?.hasFolded ?? false,
    isAllIn: handState?.isAllIn ?? false,
    isSittingOut: participant.isSittingOut,
    isBusted: participant.stack <= 0,
    visibleHoleCards: visibleHoleCardsFor(participant, table),
    isButton: hand?.buttonSeat === seatNumber,
    isSmallBlind: hand?.smallBlindSeat === seatNumber,
    isBigBlind: hand?.bigBlindSeat === seatNumber,
    isCurrentActor: hand?.currentActorSeat === seatNumber,
    inactiveForMs: hand?.currentActorSeat === seatNumber && hand.currentActorSince !== null ? now() - hand.currentActorSince : null
  };
}

function summarizeParticipant(participant: Participant, hostId: string) {
  return {
    id: participant.id,
    displayName: participant.displayName,
    isHost: participant.id === hostId,
    isConnected: participant.isConnected,
    isBot: participant.isBot
  };
}

function seatedPlayers(table: PrivateTable): Participant[] {
  return [...table.participants.values()]
    .filter(
      (participant) =>
        participant.kind === "player" &&
        participant.seatNumber !== null &&
        participant.stack > 0 &&
        !participant.isSittingOut
    )
    .sort((left, right) => (left.seatNumber ?? 0) - (right.seatNumber ?? 0));
}

export function createDeck(): Card[] {
  const suits: CardSuit[] = ["clubs", "diamonds", "hearts", "spades"];
  const ranks: CardRank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(index + 1);
    const currentCard = shuffled[index];
    const randomCard = shuffled[randomIndex];

    if (!currentCard || !randomCard) {
      throw new Error("Deck shuffle attempted to read outside the deck.");
    }

    shuffled[index] = randomCard;
    shuffled[randomIndex] = currentCard;
  }

  return shuffled;
}

function randomInt(exclusiveMax: number): number {
  const randomLimit = Math.floor(0x100000000 / exclusiveMax) * exclusiveMax;
  let value = randomBytes(4).readUInt32BE(0);

  while (value >= randomLimit) {
    value = randomBytes(4).readUInt32BE(0);
  }

  return value % exclusiveMax;
}

function drawCard(deck: Card[]): Card {
  const card = deck.pop();

  if (!card) {
    throw new Error("The deck is empty.");
  }

  return card;
}

function postBlind(
  player: Participant | undefined,
  handParticipants: Map<string, HandParticipantState>,
  amount: number
): number {
  if (!player) {
    throw new Error("Blind player was not found.");
  }

  const postedAmount = Math.min(player.stack, amount);
  const handState = handParticipants.get(player.id);

  if (!handState) {
    throw new Error("Blind player was not dealt into the hand.");
  }

  player.stack -= postedAmount;
  handState.currentBet = postedAmount;
  handState.totalCommitted = postedAmount;
  handState.isAllIn = player.stack === 0;

  return postedAmount;
}

function nextActiveSeat(activePlayers: Participant[], afterSeat: number): number {
  const sortedSeats = activePlayers.map((player) => player.seatNumber ?? 0).sort((left, right) => left - right);
  const nextSeat = sortedSeats.find((seat) => seat > afterSeat);

  return nextSeat ?? sortedSeats[0] ?? 0;
}

function applyPlayerAction(
  table: PrivateTable,
  hand: ActiveHand,
  player: Participant,
  now: () => number,
  action: LegalAction,
  raiseTo?: number
): void {
  const handState = hand.participants.get(player.id);

  if (!handState || handState.hasFolded || handState.isAllIn) {
    throw new Error("You are not active in this hand.");
  }

  const callAmount = Math.max(0, hand.currentBet - handState.currentBet);

  if (action === "fold") {
    handState.hasFolded = true;
    handState.hasActed = true;
    hand.actionLog.push(`${player.displayName} folded.`);
  } else if (action === "check") {
    if (callAmount > 0) {
      throw new Error("Cannot check while facing a bet.");
    }

    handState.hasActed = true;
    hand.actionLog.push(`${player.displayName} checked.`);
  } else if (action === "call") {
    if (callAmount <= 0) {
      throw new Error("There is no bet to call.");
    }

    const committed = commitChips(player, handState, Math.min(player.stack, callAmount));
    hand.pot += committed;
    handState.hasActed = true;
    hand.actionLog.push(
      committed < callAmount
        ? `${player.displayName} called all-in for $${committed}.`
        : `${player.displayName} called $${committed}.`
    );
  } else if (action === "raise") {
    if (typeof raiseTo !== "number" || !Number.isInteger(raiseTo)) {
      throw new Error("Raise amount is required.");
    }

    const minimumRaiseTo = hand.currentBet + hand.minimumRaiseIncrement;

    if (raiseTo < minimumRaiseTo) {
      throw new Error(`Raise must be at least $${minimumRaiseTo}.`);
    }

    const additionalChips = raiseTo - handState.currentBet;

    if (additionalChips <= callAmount) {
      throw new Error("Raise must increase the current bet.");
    }

    if (player.stack < additionalChips) {
      throw new Error("Not enough chips to raise.");
    }

    const previousCurrentBet = hand.currentBet;
    const committed = commitChips(player, handState, additionalChips);
    hand.pot += committed;
    hand.currentBet = raiseTo;
    hand.minimumRaiseIncrement = raiseTo - previousCurrentBet;

    for (const otherState of hand.participants.values()) {
      if (!otherState.hasFolded && !otherState.isAllIn) {
        otherState.hasActed = otherState.participantId === player.id;
      }
    }

    hand.actionLog.push(`${player.displayName} raised to $${raiseTo}.`);
  } else {
    if (player.stack <= 0) {
      throw new Error("You have no chips to move all-in.");
    }

    const previousCurrentBet = hand.currentBet;
    const committed = commitChips(player, handState, player.stack);
    const newBet = handState.currentBet;

    hand.pot += committed;
    handState.hasActed = true;

    if (newBet > hand.currentBet) {
      const raiseIncrement = newBet - hand.currentBet;

      hand.currentBet = newBet;

      if (raiseIncrement >= hand.minimumRaiseIncrement) {
        hand.minimumRaiseIncrement = raiseIncrement;

        for (const otherState of hand.participants.values()) {
          if (!otherState.hasFolded && !otherState.isAllIn) {
            otherState.hasActed = otherState.participantId === player.id;
          }
        }
      } else {
        handState.hasActed = true;
      }
    }

    hand.actionLog.push(
      newBet > previousCurrentBet
        ? `${player.displayName} moved all-in for $${newBet}.`
        : `${player.displayName} called all-in for $${committed}.`
    );
  }

  const remainingStates = activeHandStates(hand);

  if (remainingStates.length === 1) {
    settleFoldWin(table, hand, remainingStates[0], now);
    return;
  }

  if (isBettingRoundComplete(hand)) {
    advanceBettingRound(table, hand, now);
    return;
  }

  setCurrentActorSeat(hand, nextActorSeat(hand, player.seatNumber ?? 0), now);
}

function commitChips(player: Participant, handState: HandParticipantState, amount: number): number {
  const committed = Math.min(player.stack, amount);

  player.stack -= committed;
  handState.currentBet += committed;
  handState.totalCommitted += committed;
  handState.isAllIn = player.stack === 0;

  return committed;
}

function activeHandStates(hand: ActiveHand): HandParticipantState[] {
  return [...hand.participants.values()]
    .filter((state) => !state.hasFolded)
    .sort((left, right) => left.seatNumber - right.seatNumber);
}

function isBettingRoundComplete(hand: ActiveHand): boolean {
  return activeHandStates(hand).every(
    (state) => state.isAllIn || (state.hasActed && state.currentBet === hand.currentBet)
  );
}

function advanceBettingRound(table: PrivateTable, hand: ActiveHand, now: () => number): void {
  if (hand.phase === "river") {
    settleShowdown(table, hand, now);
    return;
  }

  const nextPhase = hand.phase === "preflop" ? "flop" : hand.phase === "flop" ? "turn" : "river";
  const cardsToDeal = nextPhase === "flop" ? 3 : 1;

  for (let index = 0; index < cardsToDeal; index += 1) {
    hand.board.push(drawCard(hand.deck));
  }

  hand.phase = nextPhase;
  hand.currentBet = 0;
  hand.minimumRaiseIncrement = table.defaults.blinds.bigBlind;

  for (const state of hand.participants.values()) {
    state.currentBet = 0;
    state.hasActed = state.hasFolded || state.isAllIn;
  }

  hand.actionLog.push(`${formatStreet(nextPhase)} dealt.`);

  if (activeHandStates(hand).filter((state) => !state.isAllIn).length < 2) {
    advanceBettingRound(table, hand, now);
    return;
  }

  setCurrentActorSeat(hand, firstPostflopActorSeat(hand), now);
}

function settleFoldWin(
  table: PrivateTable,
  hand: ActiveHand,
  winningState: HandParticipantState | undefined,
  now: () => number
): void {
  if (!winningState) {
    throw new Error("No winning player was found.");
  }

  const winner = participantById(table, winningState.participantId);

  winner.stack += hand.pot;
  hand.phase = "settled";
  setCurrentActorSeat(hand, null, now);
  hand.shouldRevealHoleCards = false;
  hand.settlementSummary = `${winner.displayName} won $${hand.pot} after everyone else folded.`;
  hand.actionLog.push(hand.settlementSummary);
  markBustedPlayersSittingOut(table);
}

function settleShowdown(table: PrivateTable, hand: ActiveHand, now: () => number): void {
  const rankedHands = new Map(
    activeHandStates(hand).map((state) => [
      state.participantId,
      {
        state,
        score: simpleHandEvaluator.evaluate([...state.holeCards, ...hand.board])
      }
    ])
  );
  const potSummaries: string[] = [];

  for (const [index, pot] of buildPots(hand).entries()) {
    const rankedEligiblePlayers = pot.eligibleParticipantIds
      .map((participantId) => rankedHands.get(participantId))
      .filter((ranked): ranked is { state: HandParticipantState; score: HandScore } => Boolean(ranked));

    if (rankedEligiblePlayers.length === 0) {
      continue;
    }

    const bestScore = rankedEligiblePlayers.reduce((best, ranked) =>
      compareScores(ranked.score, best.score) > 0 ? ranked : best
    ).score;
    const winners = rankedEligiblePlayers
      .filter((ranked) => compareScores(ranked.score, bestScore) === 0)
      .sort((left, right) => left.state.seatNumber - right.state.seatNumber);
    const baseShare = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount % winners.length;

    for (const winner of winners) {
      const player = participantById(table, winner.state.participantId);
      const extraChip = remainder > 0 ? 1 : 0;

      player.stack += baseShare + extraChip;
      remainder -= extraChip;
    }

    const winnerNames = winners.map((winner) => participantById(table, winner.state.participantId).displayName);
    const potName = index === 0 ? "main pot" : `side pot ${index}`;
    const handName = formatHandScore(bestScore);

    potSummaries.push(
      winners.length === 1
        ? `${winnerNames[0]} won $${pot.amount} from the ${potName} with ${handName}`
        : `${winnerNames.join(", ")} split $${pot.amount} from the ${potName} with ${handName}`
    );
  }

  hand.phase = "settled";
  setCurrentActorSeat(hand, null, now);
  hand.shouldRevealHoleCards = true;
  hand.settlementSummary = `${potSummaries.join(". ")}.`;
  hand.actionLog.push("Showdown.");
  hand.actionLog.push(hand.settlementSummary);
  markBustedPlayersSittingOut(table);
}

function firstPostflopActorSeat(hand: ActiveHand): number {
  return nextActorSeat(hand, hand.buttonSeat);
}

function nextActorSeat(hand: ActiveHand, afterSeat: number): number {
  const actingSeats = activeHandStates(hand)
    .filter((state) => !state.isAllIn)
    .map((state) => state.seatNumber);
  const nextSeat = actingSeats.find((seat) => seat > afterSeat);

  return nextSeat ?? actingSeats[0] ?? afterSeat;
}

function setCurrentActorSeat(hand: ActiveHand, seatNumber: number | null, now: () => number): void {
  hand.currentActorSeat = seatNumber;
  hand.currentActorSince = seatNumber === null ? null : now();
}

function currentActor(table: PrivateTable): Participant | undefined {
  const currentActorSeat = table.hand?.currentActorSeat;

  if (currentActorSeat === null || currentActorSeat === undefined) {
    return undefined;
  }

  return [...table.participants.values()].find((participant) => participant.seatNumber === currentActorSeat);
}

function hasCurrentActorWaited(hand: ActiveHand, thresholdMs: number, now: () => number): boolean {
  return hand.currentActorSince !== null && now() - hand.currentActorSince >= thresholdMs;
}

function canHostAutoFoldInactive(table: PrivateTable, viewer: Participant, now: () => number): boolean {
  if (viewer.id !== table.hostId || !table.hand) {
    return false;
  }

  const actor = currentActor(table);
  const handState = actor ? table.hand.participants.get(actor.id) : undefined;

  return Boolean(
    actor &&
      actor.isConnected &&
      !actor.isBot &&
      handState &&
      !handState.isAllIn &&
      hasCurrentActorWaited(table.hand, table.defaults.hostAutoFoldAfterMs, now)
  );
}

function visibleHoleCardsFor(participant: Participant, table: PrivateTable): Card[] {
  const hand = table.hand;
  const handState = hand?.participants.get(participant.id);

  if (!hand || !handState || !hand.shouldRevealHoleCards || handState.hasFolded) {
    return [];
  }

  return handState.holeCards;
}

function participantById(table: PrivateTable, participantId: string): Participant {
  const participant = table.participants.get(participantId);

  if (!participant) {
    throw new Error("Participant was not found for this table.");
  }

  return participant;
}

function requireParticipant(table: PrivateTable, participantId: string): Participant {
  return participantById(table, participantId);
}

function requireHost(table: PrivateTable, participant: Participant): void {
  if (participant.id !== table.hostId) {
    throw new Error("Only the host can use this control.");
  }
}

function requireBetweenHands(table: PrivateTable): void {
  if (!isBetweenHands(table)) {
    throw new Error("This control is only available between hands.");
  }
}

function isBetweenHands(table: PrivateTable): boolean {
  return !table.hand || table.hand.phase === "settled";
}

function markBustedPlayersSittingOut(table: PrivateTable): void {
  for (const participant of table.participants.values()) {
    if (participant.kind === "player" && participant.seatNumber !== null && participant.stack <= 0) {
      participant.isSittingOut = true;
    }
  }
}

function formatStreet(phase: ActiveHand["phase"]): string {
  return phase === "flop" ? "Flop" : phase === "turn" ? "Turn" : phase === "river" ? "River" : "Street";
}

type HandScore = [number, ...number[]];

type Pot = {
  amount: number;
  eligibleParticipantIds: string[];
};

const simpleHandEvaluator: HandEvaluator = {
  evaluate: evaluateBestHand
};

function evaluateBestHand(cards: Card[]): HandScore {
  const rankValues = cards.map((card) => rankValue(card.rank));
  const counts = new Map<number, number>();

  for (const value of rankValues) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const groups = [...counts.entries()].sort(
    ([leftRank, leftCount], [rightRank, rightCount]) => rightCount - leftCount || rightRank - leftRank
  );
  const flushCards = cards
    .filter((card) => cards.filter((candidate) => candidate.suit === card.suit).length >= 5)
    .map((card) => rankValue(card.rank))
    .sort((left, right) => right - left);
  const straightHigh = straightHighCard(rankValues);
  const straightFlushHigh = flushCards.length >= 5 ? straightHighCard(flushCards) : null;
  const four = groups.find(([, count]) => count === 4);
  const threes = groups.filter(([, count]) => count === 3);
  const pairs = groups.filter(([, count]) => count === 2);

  if (straightFlushHigh) {
    return [8, straightFlushHigh];
  }

  if (four) {
    return [7, four[0], ...topRanks(rankValues, 1, [four[0]])];
  }

  if (threes.length > 0 && (pairs.length > 0 || threes.length > 1)) {
    const threeRank = threes[0]?.[0] ?? 0;
    const pairRank = pairs[0]?.[0] ?? threes[1]?.[0] ?? 0;

    return [6, threeRank, pairRank];
  }

  if (flushCards.length >= 5) {
    return [5, ...topRanks(flushCards, 5)];
  }

  if (straightHigh) {
    return [4, straightHigh];
  }

  if (threes.length > 0) {
    const threeRank = threes[0]?.[0] ?? 0;

    return [3, threeRank, ...topRanks(rankValues, 2, [threeRank])];
  }

  if (pairs.length >= 2) {
    const pairRanks = pairs.slice(0, 2).map(([rank]) => rank);

    return [2, ...pairRanks, ...topRanks(rankValues, 1, pairRanks)];
  }

  if (pairs.length === 1) {
    const pairRank = pairs[0]?.[0] ?? 0;

    return [1, pairRank, ...topRanks(rankValues, 3, [pairRank])];
  }

  return [0, ...topRanks(rankValues, 5)];
}

function rankValue(rank: CardRank): number {
  const values: Record<CardRank, number> = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14
  };

  return values[rank];
}

function straightHighCard(values: number[]): number | null {
  const uniqueValues = [...new Set(values)].sort((left, right) => right - left);

  if (uniqueValues.includes(14)) {
    uniqueValues.push(1);
  }

  for (let index = 0; index <= uniqueValues.length - 5; index += 1) {
    const highCard = uniqueValues[index] ?? 0;
    const straight = [0, 1, 2, 3, 4].every((offset) => uniqueValues[index + offset] === highCard - offset);

    if (straight) {
      return highCard;
    }
  }

  return null;
}

function topRanks(values: number[], count: number, excludedRanks: number[] = []): number[] {
  return [...new Set(values)]
    .filter((value) => !excludedRanks.includes(value))
    .sort((left, right) => right - left)
    .slice(0, count);
}

function compareScores(left: HandScore, right: HandScore): number {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function legalActionsFor(player: Participant, callAmount: number, hand: ActiveHand): LegalAction[] {
  if (hand.phase === "settled") {
    return [];
  }

  const canAddChips = player.stack > 0;
  const handState = hand.participants.get(player.id);

  if (!handState || handState.isAllIn) {
    return [];
  }

  if (callAmount > 0) {
    const canRaise =
      canAddChips &&
      !handState.hasActed &&
      player.stack > callAmount &&
      handState.currentBet + player.stack >= hand.currentBet + hand.minimumRaiseIncrement;

    return canAddChips ? ["fold", "call", ...(canRaise ? (["raise"] as const) : []), "all-in"] : ["fold"];
  }

  const canRaise = canAddChips && player.stack >= hand.minimumRaiseIncrement;

  return canAddChips ? ["check", ...(canRaise ? (["raise"] as const) : []), "all-in"] : ["check"];
}

function buildPots(hand: ActiveHand): Pot[] {
  const committedLevels = [...new Set([...hand.participants.values()].map((state) => state.totalCommitted).filter(Boolean))]
    .sort((left, right) => left - right);
  const pots: Pot[] = [];
  let previousLevel = 0;

  for (const level of committedLevels) {
    const contributors = [...hand.participants.values()].filter((state) => state.totalCommitted >= level);
    const amount = (level - previousLevel) * contributors.length;

    if (amount > 0) {
      pots.push({
        amount,
        eligibleParticipantIds: contributors
          .filter((state) => !state.hasFolded)
          .map((state) => state.participantId)
      });
    }

    previousLevel = level;
  }

  return pots;
}

function formatHandScore(score: HandScore): string {
  const names = [
    "high card",
    "one pair",
    "two pair",
    "three of a kind",
    "a straight",
    "a flush",
    "a full house",
    "four of a kind",
    "a straight flush"
  ];

  return names[score[0]] ?? "a hand";
}

function reconnectParticipant(table: PrivateTable, sessionToken: string): Participant | undefined {
  const participantId = table.participantIdsByToken.get(sessionToken);
  const participant = participantId ? table.participants.get(participantId) : undefined;

  if (participant) {
    participant.isConnected = true;

    if (
      isBetweenHands(table) &&
      participant.kind === "player" &&
      participant.seatNumber !== null &&
      participant.stack > 0
    ) {
      participant.isSittingOut = false;
    }
  }

  return participant;
}

function nextOpenSeat(table: PrivateTable): number | null {
  const occupiedSeats = new Set(
    [...table.participants.values()]
      .filter((participant) => participant.kind === "player" && participant.seatNumber !== null)
      .map((participant) => participant.seatNumber)
  );

  for (let seatNumber = 0; seatNumber < MAX_SEATS; seatNumber += 1) {
    if (!occupiedSeats.has(seatNumber)) {
      return seatNumber;
    }
  }

  return null;
}

function getExistingTable(tables: Map<string, PrivateTable>, tableId: string): PrivateTable {
  const table = tables.get(tableId);

  if (!table) {
    throw new Error("Table was not found.");
  }

  return table;
}

function createUniqueId(tables: Map<string, PrivateTable>): string {
  let tableId = randomToken(16);

  while (tables.has(tableId)) {
    tableId = randomToken(16);
  }

  return tableId;
}

function randomToken(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}

function normalizeDisplayName(displayName: string): string {
  const normalized = displayName.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Display name is required.");
  }

  if (normalized.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error(`Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`);
  }

  return normalized;
}

function normalizeChatBody(body: string): string {
  const normalized = body.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Chat message is required.");
  }

  if (normalized.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error(`Chat message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer.`);
  }

  return normalized;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
