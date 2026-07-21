import type { Card, CardRank } from "./index.js";

// The single authoritative poker hand evaluator, shared by the server's showdown
// settlement and the bot's strategy so the two can never disagree on hand
// strength. A hand's score is its category (0 = high card ... 8 = straight flush)
// followed by tiebreak ranks, highest first; longer/greater scores win via
// compareHandScores.
export type HandScore = [number, ...number[]];

const RANK_VALUES: Record<CardRank, number> = {
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

export function rankValue(rank: CardRank): number {
  return RANK_VALUES[rank];
}

// Highest card of the best five-card straight in `values`, or null when there is
// none. Treats an ace as both high (14) and low (1) so the wheel (A-2-3-4-5) is
// recognised with a high card of 5.
export function straightHighCard(values: number[]): number | null {
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

// Evaluates the best five-card hand from up to seven cards into a comparable score.
export function evaluateHand(cards: Card[]): HandScore {
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

// The made-hand category only (0 = high card ... 8 = straight flush), i.e. the
// leading element of evaluateHand's score. Used where only relative hand class
// matters (bot strength estimation).
export function handCategory(cards: Card[]): number {
  return evaluateHand(cards)[0];
}

// Compares two scores element by element; positive when `left` wins, negative
// when `right` wins, zero on a tie.
export function compareHandScores(left: HandScore, right: HandScore): number {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function topRanks(values: number[], count: number, excludedRanks: number[] = []): number[] {
  return [...new Set(values)]
    .filter((value) => !excludedRanks.includes(value))
    .sort((left, right) => right - left)
    .slice(0, count);
}
