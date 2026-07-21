import { describe, expect, it } from "vitest";
import { buildPots, legalActionsFor } from "./gameEngine.js";
import type { ActiveHand, HandParticipantState, Participant } from "./tableTypes.js";

// These tests exercise the extracted game-engine functions in isolation, i.e.
// without going through createTableStore, to demonstrate they are unit-testable
// on their own.

function handState(overrides: Partial<HandParticipantState> & { participantId: string }): HandParticipantState {
  return {
    seatNumber: 0,
    holeCards: [],
    currentBet: 0,
    totalCommitted: 0,
    hasFolded: false,
    hasActed: false,
    isAllIn: false,
    ...overrides
  };
}

function makeHand(states: HandParticipantState[], overrides: Partial<ActiveHand> = {}): ActiveHand {
  return {
    handNumber: 1,
    phase: "preflop",
    deck: [],
    board: [],
    buttonSeat: 0,
    smallBlindSeat: 1,
    bigBlindSeat: 2,
    currentActorSeat: 0,
    currentActorSince: 0,
    participants: new Map(states.map((state) => [state.participantId, state])),
    pot: 0,
    currentBet: 0,
    minimumRaiseIncrement: 10,
    actionLog: [],
    settlementSummary: null,
    shouldRevealHoleCards: false,
    ...overrides
  };
}

describe("gameEngine.buildPots", () => {
  it("splits an uneven all-in into a main pot and a side pot", () => {
    const hand = makeHand([
      handState({ participantId: "a", seatNumber: 0, totalCommitted: 100, isAllIn: true }),
      handState({ participantId: "b", seatNumber: 1, totalCommitted: 300 }),
      handState({ participantId: "c", seatNumber: 2, totalCommitted: 300 })
    ]);

    const pots = buildPots(hand);

    expect(pots).toEqual([
      { amount: 300, eligibleParticipantIds: ["a", "b", "c"] },
      { amount: 400, eligibleParticipantIds: ["b", "c"] }
    ]);
  });

  it("excludes folded players from pot eligibility but keeps their chips", () => {
    const hand = makeHand([
      handState({ participantId: "a", seatNumber: 0, totalCommitted: 50, hasFolded: true }),
      handState({ participantId: "b", seatNumber: 1, totalCommitted: 50 })
    ]);

    const pots = buildPots(hand);

    expect(pots).toEqual([{ amount: 100, eligibleParticipantIds: ["b"] }]);
  });
});

describe("gameEngine.legalActionsFor", () => {
  const player = { id: "p", stack: 1000 } as Participant;

  it("offers check/raise/all-in when no bet is faced", () => {
    const hand = makeHand([handState({ participantId: "p", seatNumber: 0 })], { currentBet: 0 });

    expect(legalActionsFor(player, 0, hand)).toEqual(["check", "raise", "all-in"]);
  });

  it("offers fold/call/raise/all-in when facing a bet", () => {
    const hand = makeHand([handState({ participantId: "p", seatNumber: 0 })], {
      currentBet: 10,
      minimumRaiseIncrement: 10
    });

    expect(legalActionsFor(player, 10, hand)).toEqual(["fold", "call", "raise", "all-in"]);
  });

  it("returns no actions once the hand is settled", () => {
    const hand = makeHand([handState({ participantId: "p", seatNumber: 0 })], { phase: "settled" });

    expect(legalActionsFor(player, 0, hand)).toEqual([]);
  });
});
