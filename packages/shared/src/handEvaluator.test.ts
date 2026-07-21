import { describe, expect, it } from "vitest";
import type { Card, CardRank, CardSuit } from "./index.js";
import {
  compareHandScores,
  evaluateHand,
  handCategory,
  rankValue,
  straightHighCard
} from "./handEvaluator.js";

function card(rank: CardRank, suit: CardSuit): Card {
  return { rank, suit };
}

// Categories: 0 high card, 1 pair, 2 two pair, 3 trips, 4 straight, 5 flush,
// 6 full house, 7 quads, 8 straight flush.
describe("hand evaluator", () => {
  it("maps ranks to values with the ace high", () => {
    expect(rankValue("2")).toBe(2);
    expect(rankValue("10")).toBe(10);
    expect(rankValue("A")).toBe(14);
  });

  it("recognises the wheel straight with a high card of five", () => {
    expect(straightHighCard([14, 2, 3, 4, 5])).toBe(5);
    expect(straightHighCard([10, 11, 12, 13, 14])).toBe(14);
    expect(straightHighCard([2, 3, 4, 5, 7])).toBeNull();
  });

  it("scores a wheel straight as category 4 high 5", () => {
    const score = evaluateHand([
      card("A", "spades"),
      card("2", "hearts"),
      card("3", "clubs"),
      card("4", "diamonds"),
      card("5", "spades")
    ]);

    expect(score).toEqual([4, 5]);
  });

  it("scores a straight flush above quads", () => {
    const straightFlush = evaluateHand([
      card("9", "hearts"),
      card("8", "hearts"),
      card("7", "hearts"),
      card("6", "hearts"),
      card("5", "hearts")
    ]);
    const quads = evaluateHand([
      card("A", "spades"),
      card("A", "hearts"),
      card("A", "clubs"),
      card("A", "diamonds"),
      card("K", "spades")
    ]);

    expect(straightFlush).toEqual([8, 9]);
    expect(quads).toEqual([7, 14, 13]);
    expect(compareHandScores(straightFlush, quads)).toBeGreaterThan(0);
  });

  it("scores a full house, including two sets of trips", () => {
    const boat = evaluateHand([
      card("K", "spades"),
      card("K", "hearts"),
      card("K", "clubs"),
      card("Q", "diamonds"),
      card("Q", "spades")
    ]);
    const twoTrips = evaluateHand([
      card("K", "spades"),
      card("K", "hearts"),
      card("K", "clubs"),
      card("Q", "diamonds"),
      card("Q", "spades"),
      card("Q", "hearts")
    ]);

    expect(boat).toEqual([6, 13, 12]);
    // The higher trips make the hand; the lower trips play as the pair.
    expect(twoTrips).toEqual([6, 13, 12]);
  });

  it("scores two pair with the correct kicker", () => {
    const twoPair = evaluateHand([
      card("A", "spades"),
      card("A", "hearts"),
      card("K", "clubs"),
      card("K", "diamonds"),
      card("Q", "spades")
    ]);

    expect(twoPair).toEqual([2, 14, 13, 12]);
  });

  it("exposes the category alone as the leading score element", () => {
    const cards = [
      card("A", "spades"),
      card("A", "hearts"),
      card("K", "clubs"),
      card("K", "diamonds"),
      card("Q", "spades")
    ];

    expect(handCategory(cards)).toBe(evaluateHand(cards)[0]);
    expect(handCategory(cards)).toBe(2);
  });

  it("compares scores by category, then tiebreak ranks, and reports ties", () => {
    const higherPair = evaluateHand([
      card("A", "spades"),
      card("A", "hearts"),
      card("9", "clubs"),
      card("5", "diamonds"),
      card("3", "spades")
    ]);
    const lowerPair = evaluateHand([
      card("K", "spades"),
      card("K", "hearts"),
      card("9", "clubs"),
      card("5", "diamonds"),
      card("3", "spades")
    ]);
    const higherKicker = evaluateHand([
      card("A", "spades"),
      card("A", "hearts"),
      card("Q", "clubs"),
      card("5", "diamonds"),
      card("3", "spades")
    ]);

    expect(compareHandScores(higherPair, lowerPair)).toBeGreaterThan(0);
    expect(compareHandScores(higherKicker, higherPair)).toBeGreaterThan(0);
    expect(compareHandScores(higherPair, higherPair)).toBe(0);
  });
});
