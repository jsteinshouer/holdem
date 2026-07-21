import {
  compareHandScores,
  evaluateHand,
  type Card,
  type HandScore,
  type LegalAction
} from "@friendly-holdem/shared";
import { createDeck, drawCard, shuffleDeck } from "./random.js";
import {
  type ActiveHand,
  type HandParticipantState,
  type Participant,
  type Pot,
  type PrivateTable
} from "./tableTypes.js";

type HandEvaluator = {
  evaluate(cards: Card[]): HandScore;
};

const simpleHandEvaluator: HandEvaluator = {
  evaluate: evaluateHand
};

export function createHand(
  table: PrivateTable,
  activePlayers: Participant[],
  previousHand: ActiveHand | null,
  now: () => number
): ActiveHand {
  const deck = shuffleDeck(createDeck());
  const buttonSeat = previousHand ? nextActiveSeat(activePlayers, previousHand.buttonSeat) : activePlayers[0]?.seatNumber ?? 0;
  const smallBlindSeat = activePlayers.length === 2 ? buttonSeat : nextActiveSeat(activePlayers, buttonSeat);
  const bigBlindSeat = nextActiveSeat(activePlayers, smallBlindSeat);
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

  const hand: ActiveHand = {
    handNumber: previousHand ? previousHand.handNumber + 1 : 1,
    phase: "preflop",
    deck,
    board: [],
    buttonSeat,
    smallBlindSeat,
    bigBlindSeat,
    currentActorSeat: bigBlindSeat,
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

  // A short-stacked blind poster can already be all-in before anyone acts, so the first
  // actor must be chosen from players who can still voluntarily act (skipping all-in and
  // folded seats). Preflop betting is only closed before it begins when no live player
  // still owes a call: either everyone is all-in, or the lone live player has already
  // matched the current bet (e.g. a big blind whose only opponent is all-in for less). In
  // that case run the board out to showdown; otherwise the live player is still owed their
  // turn to call or fold, so give them the action.
  const liveStates = activeHandStates(hand).filter((state) => !state.isAllIn);
  const [loneLiveState] = liveStates;
  const bettingClosedBeforeAction =
    liveStates.length === 0 ||
    (liveStates.length === 1 && loneLiveState?.currentBet === hand.currentBet);

  if (bettingClosedBeforeAction) {
    advanceBettingRound(table, hand, now);
  } else {
    setCurrentActorSeat(hand, nextActorSeat(hand, bigBlindSeat), now);
  }

  return hand;
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

export function applyPlayerAction(
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

export function activeHandStates(hand: ActiveHand): HandParticipantState[] {
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
      compareHandScores(ranked.score, best.score) > 0 ? ranked : best
    ).score;
    const winners = rankedEligiblePlayers
      .filter((ranked) => compareHandScores(ranked.score, bestScore) === 0)
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

export function hasCurrentActorWaited(hand: ActiveHand, thresholdMs: number, now: () => number): boolean {
  return hand.currentActorSince !== null && now() - hand.currentActorSince >= thresholdMs;
}

export function participantById(table: PrivateTable, participantId: string): Participant {
  const participant = table.participants.get(participantId);

  if (!participant) {
    throw new Error("Participant was not found for this table.");
  }

  return participant;
}

export function markBustedPlayersSittingOut(table: PrivateTable): void {
  for (const participant of table.participants.values()) {
    if (participant.kind === "player" && participant.seatNumber !== null && participant.stack <= 0) {
      participant.isSittingOut = true;
    }
  }
}

function formatStreet(phase: ActiveHand["phase"]): string {
  return phase === "flop" ? "Flop" : phase === "turn" ? "Turn" : phase === "river" ? "River" : "Street";
}

export function legalActionsFor(player: Participant, callAmount: number, hand: ActiveHand): LegalAction[] {
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

export function buildPots(hand: ActiveHand): Pot[] {
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
