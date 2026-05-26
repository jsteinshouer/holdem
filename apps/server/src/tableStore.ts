import { randomBytes } from "node:crypto";
import type {
  Card,
  CardRank,
  CardSuit,
  HandSnapshot,
  LegalAction,
  TableDefaults,
  TableSnapshot,
  TableSessionResponse,
  ViewerRole
} from "@friendly-holdem/shared";

const MAX_SEATS = 6;
const MAX_DISPLAY_NAME_LENGTH = 32;

type ParticipantKind = "player" | "spectator";

export type Participant = {
  id: string;
  displayName: string;
  sessionToken: string;
  kind: ParticipantKind;
  seatNumber: number | null;
  stack: number;
  isConnected: boolean;
};

type HandParticipantState = {
  participantId: string;
  seatNumber: number;
  holeCards: Card[];
  currentBet: number;
};

type ActiveHand = {
  handNumber: number;
  phase: "preflop";
  deck: Card[];
  board: Card[];
  buttonSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentActorSeat: number;
  participants: Map<string, HandParticipantState>;
  pot: number;
  currentBet: number;
};

export type PrivateTable = {
  id: string;
  hostId: string;
  participants: Map<string, Participant>;
  participantIdsByToken: Map<string, string>;
  hasHandStarted: boolean;
  hand: ActiveHand | null;
  defaults: TableDefaults;
};

export type TableStore = ReturnType<typeof createTableStore>;

export function createTableStore(defaults: TableDefaults, origin?: string) {
  const tables = new Map<string, PrivateTable>();

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
      defaults
    };

    tables.set(table.id, table);

    return {
      ok: true,
      sessionToken: host.sessionToken,
      snapshot: createSnapshot(table, host.id, origin)
    };
  }

  function joinTable(tableId: string, displayName: string, sessionToken?: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);

    if (sessionToken) {
      const reconnected = reconnectParticipant(table, sessionToken);

      if (reconnected) {
        return {
          ok: true,
          sessionToken: reconnected.sessionToken,
          snapshot: createSnapshot(table, reconnected.id, origin)
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

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin)
    };
  }

  function reconnectTable(tableId: string, sessionToken: string): TableSessionResponse {
    const table = getExistingTable(tables, tableId);
    const participant = reconnectParticipant(table, sessionToken);

    if (!participant) {
      throw new Error("Session was not found for this table.");
    }

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin)
    };
  }

  function disconnectParticipant(tableId: string, participantId: string): void {
    const participant = tables.get(tableId)?.participants.get(participantId);

    if (participant) {
      participant.isConnected = false;
    }
  }

  function snapshotFor(tableId: string, participantId: string): TableSnapshot {
    return createSnapshot(getExistingTable(tables, tableId), participantId, origin);
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

    table.hand = createFirstHand(table, activePlayers);
    table.hasHandStarted = true;

    return {
      ok: true,
      sessionToken: participant.sessionToken,
      snapshot: createSnapshot(table, participant.id, origin)
    };
  }

  function getTable(tableId: string): PrivateTable | undefined {
    return tables.get(tableId);
  }

  return {
    createTable,
    joinTable,
    reconnectTable,
    disconnectParticipant,
    snapshotFor,
    startHand,
    getTable
  };
}

function createParticipant(
  displayName: string,
  kind: ParticipantKind,
  seatNumber: number | null,
  stack: number
): Participant {
  return {
    id: randomToken(16),
    displayName: normalizeDisplayName(displayName),
    sessionToken: randomToken(32),
    kind,
    seatNumber,
    stack,
    isConnected: true
  };
}

function createSnapshot(table: PrivateTable, viewerParticipantId: string, origin?: string): TableSnapshot {
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
      player: player ? summarizeSeatPlayer(player, table) : null
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
    hasHandStarted: table.hasHandStarted,
    hand: createHandSnapshot(table, viewer),
    availableControls: {
      canStartHand: viewer.id === table.hostId && !table.hand && seats.filter((seat) => seat.player).length >= 2,
      canDealNextHand: false,
      canSeatSpectators:
        viewer.id === table.hostId && !table.hasHandStarted && spectators.length > 0 && nextOpenSeat(table) !== null
    },
    defaults: table.defaults
  };
}

function createFirstHand(table: PrivateTable, activePlayers: Participant[]): ActiveHand {
  const deck = shuffleDeck(createDeck());
  const buttonSeat = activePlayers[0]?.seatNumber ?? 0;
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
      currentBet: 0
    });
  }

  const smallBlindPlayer = activePlayers.find((player) => player.seatNumber === smallBlindSeat);
  const bigBlindPlayer = activePlayers.find((player) => player.seatNumber === bigBlindSeat);
  const smallBlindAmount = postBlind(smallBlindPlayer, handParticipants, table.defaults.blinds.smallBlind);
  const bigBlindAmount = postBlind(bigBlindPlayer, handParticipants, table.defaults.blinds.bigBlind);

  return {
    handNumber: 1,
    phase: "preflop",
    deck,
    board: [],
    buttonSeat,
    smallBlindSeat,
    bigBlindSeat,
    currentActorSeat,
    participants: handParticipants,
    pot: smallBlindAmount + bigBlindAmount,
    currentBet: Math.max(smallBlindAmount, bigBlindAmount)
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
      legalActions: [],
      viewerHoleCards: []
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
    legalActions: viewer.seatNumber === hand.currentActorSeat ? legalActionsFor(viewer, callAmount) : [],
    viewerHoleCards: viewerHandState?.holeCards ?? []
  };
}

function summarizeSeatPlayer(participant: Participant, table: PrivateTable) {
  const hand = table.hand;
  const handState = hand?.participants.get(participant.id);
  const seatNumber = participant.seatNumber ?? -1;

  return {
    ...summarizeParticipant(participant, table.hostId),
    stack: participant.stack,
    currentBet: handState?.currentBet ?? 0,
    hasCards: Boolean(handState),
    isButton: hand?.buttonSeat === seatNumber,
    isSmallBlind: hand?.smallBlindSeat === seatNumber,
    isBigBlind: hand?.bigBlindSeat === seatNumber,
    isCurrentActor: hand?.currentActorSeat === seatNumber
  };
}

function summarizeParticipant(participant: Participant, hostId: string) {
  return {
    id: participant.id,
    displayName: participant.displayName,
    isHost: participant.id === hostId,
    isConnected: participant.isConnected
  };
}

function seatedPlayers(table: PrivateTable): Participant[] {
  return [...table.participants.values()]
    .filter((participant) => participant.kind === "player" && participant.seatNumber !== null && participant.stack > 0)
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

  return postedAmount;
}

function nextActiveSeat(activePlayers: Participant[], afterSeat: number): number {
  const sortedSeats = activePlayers.map((player) => player.seatNumber ?? 0).sort((left, right) => left - right);
  const nextSeat = sortedSeats.find((seat) => seat > afterSeat);

  return nextSeat ?? sortedSeats[0] ?? 0;
}

function legalActionsFor(player: Participant, callAmount: number): LegalAction[] {
  const canAddChips = player.stack > 0;

  if (callAmount > 0) {
    return canAddChips ? ["fold", "call", "raise", "all-in"] : ["fold"];
  }

  return canAddChips ? ["check", "raise", "all-in"] : ["check"];
}

function reconnectParticipant(table: PrivateTable, sessionToken: string): Participant | undefined {
  const participantId = table.participantIdsByToken.get(sessionToken);
  const participant = participantId ? table.participants.get(participantId) : undefined;

  if (participant) {
    participant.isConnected = true;
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
