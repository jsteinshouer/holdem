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

    applyPlayerAction(table, hand, participant, action, raiseTo);

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
    playerAction,
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
    legalActions: viewer.seatNumber === hand.currentActorSeat ? legalActionsFor(viewer, callAmount, hand) : [],
    viewerHoleCards: viewerHandState?.holeCards ?? [],
    actionLog: hand.actionLog,
    settlementSummary: hand.settlementSummary
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
    hasFolded: handState?.hasFolded ?? false,
    visibleHoleCards: visibleHoleCardsFor(participant, table),
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
    settleFoldWin(table, hand, remainingStates[0]);
    return;
  }

  if (isBettingRoundComplete(hand)) {
    advanceBettingRound(table, hand);
    return;
  }

  hand.currentActorSeat = nextActorSeat(hand, player.seatNumber ?? 0);
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

function advanceBettingRound(table: PrivateTable, hand: ActiveHand): void {
  if (hand.phase === "river") {
    settleShowdown(table, hand);
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
    advanceBettingRound(table, hand);
    return;
  }

  hand.currentActorSeat = firstPostflopActorSeat(hand);
}

function settleFoldWin(table: PrivateTable, hand: ActiveHand, winningState: HandParticipantState | undefined): void {
  if (!winningState) {
    throw new Error("No winning player was found.");
  }

  const winner = participantById(table, winningState.participantId);

  winner.stack += hand.pot;
  hand.phase = "settled";
  hand.currentActorSeat = null;
  hand.shouldRevealHoleCards = false;
  hand.settlementSummary = `${winner.displayName} won $${hand.pot} after everyone else folded.`;
  hand.actionLog.push(hand.settlementSummary);
}

function settleShowdown(table: PrivateTable, hand: ActiveHand): void {
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
  hand.currentActorSeat = null;
  hand.shouldRevealHoleCards = true;
  hand.settlementSummary = `${potSummaries.join(". ")}.`;
  hand.actionLog.push("Showdown.");
  hand.actionLog.push(hand.settlementSummary);
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
