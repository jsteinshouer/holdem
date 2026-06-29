import { describe, expect, it } from "vitest";
import type { Card, LegalAction } from "@friendly-holdem/shared";
import {
  createSeededRandom,
  createSimpleBotStrategy,
  estimateHandStrength,
  simpleBotStrategy,
  type BotDecisionContext
} from "./botStrategy.js";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function context(overrides: Partial<BotDecisionContext> = {}): BotDecisionContext {
  return {
    holeCards: [card("7", "clubs"), card("2", "diamonds")],
    board: [],
    legalActions: ["fold", "call", "raise", "all-in"] as LegalAction[],
    callAmount: 10,
    pot: 30,
    currentBet: 10,
    viewerBet: 0,
    minimumRaiseTo: 20,
    stack: 1000,
    activePlayerCount: 3,
    playersYetToAct: 1,
    random: () => 0.5,
    ...overrides
  };
}

describe("simple bot strategy", () => {
  it("rates premium starting hands far above trash", () => {
    const premium = estimateHandStrength([card("A", "spades"), card("A", "hearts")], []);
    const trash = estimateHandStrength([card("7", "clubs"), card("2", "diamonds")], []);

    expect(premium).toBeGreaterThan(0.9);
    expect(trash).toBeLessThan(0.3);
    expect(premium).toBeGreaterThan(trash);
  });

  it("rates a made flush above a lone pair postflop", () => {
    const flush = estimateHandStrength(
      [card("A", "spades"), card("3", "spades")],
      [card("K", "spades"), card("9", "spades"), card("4", "spades")]
    );
    const pair = estimateHandStrength(
      [card("A", "clubs"), card("3", "diamonds")],
      [card("A", "hearts"), card("9", "spades"), card("4", "clubs")]
    );

    expect(flush).toBeGreaterThan(pair);
  });

  it("raises with a premium hand and folds trash facing a bet", () => {
    const raise = simpleBotStrategy.decide(
      context({ holeCards: [card("A", "spades"), card("A", "hearts")] })
    );
    const fold = simpleBotStrategy.decide(
      context({ holeCards: [card("8", "clubs"), card("3", "diamonds")] })
    );

    expect(raise.action).toBe("raise");
    expect(fold.action).toBe("fold");
  });

  it("checks rather than folds when there is no bet to face", () => {
    const decision = simpleBotStrategy.decide(
      context({
        holeCards: [card("9", "clubs"), card("4", "diamonds")],
        legalActions: ["check", "raise", "all-in"],
        callAmount: 0,
        currentBet: 0,
        minimumRaiseTo: 10
      })
    );

    expect(decision.action).toBe("check");
  });

  it("sizes raises as a clamped pot fraction within the legal range", () => {
    const decision = simpleBotStrategy.decide(
      context({
        holeCards: [card("A", "spades"), card("A", "hearts")],
        pot: 100,
        currentBet: 10,
        minimumRaiseTo: 20,
        stack: 1000,
        random: () => 0.5
      })
    );

    expect(decision.action).toBe("raise");
    expect(decision.raiseTo).toBeGreaterThanOrEqual(20);
    expect(decision.raiseTo).toBeLessThanOrEqual(1000);
    // currentBet 10 + round(0.625 * 100) = 73.
    expect(decision.raiseTo).toBe(73);
  });

  it("turns an unaffordable raise into an all-in", () => {
    const decision = simpleBotStrategy.decide(
      context({
        holeCards: [card("A", "spades"), card("A", "hearts")],
        pot: 400,
        currentBet: 10,
        minimumRaiseTo: 20,
        viewerBet: 0,
        stack: 40
      })
    );

    expect(decision.action).toBe("all-in");
  });

  it("never meets the min raise yet still returns a legal action without a raise option", () => {
    const decision = simpleBotStrategy.decide(
      context({
        holeCards: [card("A", "spades"), card("A", "hearts")],
        legalActions: ["fold", "call", "all-in"],
        callAmount: 10,
        pot: 50
      })
    );

    expect(["call", "all-in"]).toContain(decision.action);
  });

  it("is reproducible under a fixed seed", () => {
    const marginalHand = [card("J", "clubs"), card("9", "clubs")];
    const decisionFor = (seed: number) =>
      createSimpleBotStrategy().decide(
        context({ holeCards: marginalHand, board: [], random: createSeededRandom(seed) })
      );

    expect(decisionFor(7)).toEqual(decisionFor(7));
  });
});
