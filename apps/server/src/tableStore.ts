import {
  type Card,
  type HandSnapshot,
  type LegalAction,
  type TableDefaults,
  type TableSnapshot,
  type TableSessionResponse,
  type ViewerRole
} from "@friendly-holdem/shared";
import { ACTIVE_TABLE_SCHEMA_VERSION, type ActiveTablePersistencePort } from "./activeTablePersistence.js";
import { simpleBotStrategy, type BotDecision, type BotStrategy } from "./botStrategy.js";
import {
  activeHandStates,
  applyPlayerAction,
  createHand,
  hasCurrentActorWaited,
  legalActionsFor,
  markBustedPlayersSittingOut,
  participantById
} from "./gameEngine.js";
import { randomToken } from "./random.js";
import { deserializeTable, serializeTable } from "./tableSerialization.js";
import {
  type ActiveHand,
  type Participant,
  type ParticipantKind,
  type PrivateTable
} from "./tableTypes.js";

export { createDeck } from "./random.js";
export type {
  Participant,
  PrivateTable,
  SerializedActiveHand,
  SerializedActiveTableState
} from "./tableTypes.js";

const MAX_SEATS = 6;
const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_CHAT_MESSAGE_LENGTH = 180;
const CHAT_RATE_LIMIT_MS = 1500;
const BOT_NAMES = ["Bluffy", "Chip", "Maverick", "Ace", "Rounder", "Sleeves"];

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

function currentActor(table: PrivateTable): Participant | undefined {
  const currentActorSeat = table.hand?.currentActorSeat;

  if (currentActorSeat === null || currentActorSeat === undefined) {
    return undefined;
  }

  return [...table.participants.values()].find((participant) => participant.seatNumber === currentActorSeat);
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
