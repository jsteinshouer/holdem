import type { Card, CardRank, LegalAction } from "@friendly-holdem/shared";

// Decision logic for a simple, rule-based bot player. The strategy is a pure
// function of the bot's own player-specific view of the hand plus an injected
// random source, so a future strategy (such as a local model) can replace it
// behind this same interface without changing seating, timing, or persistence.

export type BotDecision = {
  action: LegalAction;
  raiseTo?: number;
};

export type BotDecisionContext = {
  holeCards: Card[];
  board: Card[];
  legalActions: LegalAction[];
  callAmount: number;
  pot: number;
  currentBet: number;
  // The bot's chips already committed this betting round.
  viewerBet: number;
  // Lowest legal total bet level the bot may raise to.
  minimumRaiseTo: number;
  stack: number;
  // Active (not folded) players contesting the hand, including the bot.
  activePlayerCount: number;
  // Opponents still to act after the bot this round; lower means later position.
  playersYetToAct: number;
  random: () => number;
};

export type BotStrategy = {
  id: string;
  decide(context: BotDecisionContext): BotDecision;
};

export type SimpleBotConstants = {
  // Below this estimated strength the bot folds to a bet it has no price to call.
  foldEquityThreshold: number;
  // At or above this estimated strength the bot bets or raises for value.
  raiseStrengthThreshold: number;
  // Raise sizing is a random fraction of the pot within this range.
  minPotFraction: number;
  maxPotFraction: number;
  // Bounded +/- jitter applied to the strength estimate so play is varied.
  randomness: number;
  // How much later position loosens the raising threshold.
  positionAggression: number;
};

export const DEFAULT_SIMPLE_BOT_CONSTANTS: SimpleBotConstants = {
  foldEquityThreshold: 0.3,
  raiseStrengthThreshold: 0.68,
  minPotFraction: 0.5,
  maxPotFraction: 0.75,
  randomness: 0.08,
  positionAggression: 0.05
};

export const SIMPLE_BOT_STRATEGY_ID = "simple-v1";

export function createSimpleBotStrategy(overrides: Partial<SimpleBotConstants> = {}): BotStrategy {
  const constants = { ...DEFAULT_SIMPLE_BOT_CONSTANTS, ...overrides };

  return {
    id: SIMPLE_BOT_STRATEGY_ID,
    decide(context) {
      return decideSimpleAction(context, constants);
    }
  };
}

export const simpleBotStrategy = createSimpleBotStrategy();

// Deterministic PRNG (mulberry32) so seeded callers get reproducible decisions.
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function decideSimpleAction(context: BotDecisionContext, constants: SimpleBotConstants): BotDecision {
  const { legalActions } = context;
  const canRaise = legalActions.includes("raise");
  const canCall = legalActions.includes("call");
  const canCheck = legalActions.includes("check");
  const canAllIn = legalActions.includes("all-in");
  const facingBet = context.callAmount > 0;
  const jitter = (context.random() * 2 - 1) * constants.randomness;
  const strength = clamp(estimateHandStrength(context.holeCards, context.board) + jitter, 0, 1);
  const positionBonus = context.playersYetToAct === 0 ? constants.positionAggression : 0;
  const raiseThreshold = constants.raiseStrengthThreshold - positionBonus;

  if (canRaise && strength >= raiseThreshold) {
    return raiseDecision(context, constants);
  }

  if (facingBet) {
    const potOdds = context.callAmount / (context.pot + context.callAmount);
    const callThreshold = Math.max(constants.foldEquityThreshold, potOdds);

    if (canCall && strength >= callThreshold) {
      return { action: "call" };
    }

    return { action: "fold" };
  }

  if (canCheck) {
    return { action: "check" };
  }

  // No bet to face and checking is unavailable only when all-in is the lone move.
  return canAllIn ? { action: "all-in" } : { action: "fold" };
}

function raiseDecision(context: BotDecisionContext, constants: SimpleBotConstants): BotDecision {
  const fraction =
    constants.minPotFraction + context.random() * (constants.maxPotFraction - constants.minPotFraction);
  const desiredRaiseTo = context.currentBet + Math.round(fraction * context.pot);
  const allInRaiseTo = context.viewerBet + context.stack;
  const raiseTo = Math.max(context.minimumRaiseTo, desiredRaiseTo);

  // Sizing that meets or exceeds the bot's stack becomes a clean all-in.
  if (raiseTo >= allInRaiseTo) {
    return context.legalActions.includes("all-in") ? { action: "all-in" } : { action: "raise", raiseTo: allInRaiseTo };
  }

  return { action: "raise", raiseTo };
}

// Estimates a 0..1 strength for the bot's holding. Preflop uses starting-hand
// quality; postflop uses the best made-hand category from the seven cards.
export function estimateHandStrength(holeCards: Card[], board: Card[]): number {
  if (board.length === 0) {
    return preflopStrength(holeCards);
  }

  return postflopStrength([...holeCards, ...board]);
}

function preflopStrength(holeCards: Card[]): number {
  const [first, second] = holeCards;

  if (!first || !second) {
    return 0;
  }

  const highValue = Math.max(rankValue(first.rank), rankValue(second.rank));
  const lowValue = Math.min(rankValue(first.rank), rankValue(second.rank));

  if (highValue === lowValue) {
    // Pocket pairs: a pair of deuces is already mid-strength, aces are the top.
    return clamp(0.5 + ((highValue - 2) / 12) * 0.5, 0, 1);
  }

  const highScore = ((highValue - 2) / 12) * 0.5;
  const lowScore = ((lowValue - 2) / 12) * 0.2;
  const suitedBonus = first.suit === second.suit ? 0.08 : 0;
  const gap = highValue - lowValue;
  const connectorBonus = gap === 1 ? 0.06 : gap === 2 ? 0.04 : gap === 3 ? 0.02 : 0;

  return clamp(highScore + lowScore + suitedBonus + connectorBonus, 0, 1);
}

function postflopStrength(cards: Card[]): number {
  const category = bestHandCategory(cards);
  const baseByCategory = [0.18, 0.35, 0.5, 0.62, 0.72, 0.8, 0.88, 0.95, 0.99];
  const base = baseByCategory[category] ?? 0.18;
  const topRank = Math.max(...cards.map((card) => rankValue(card.rank)));
  // Nudge weak made hands by their high card so A-high beats 7-high.
  const kicker = category <= 1 ? ((topRank - 2) / 12) * 0.1 : 0;

  return clamp(base + kicker, 0, 1);
}

// Returns the standard hand category for up to seven cards, where 0 is high
// card and 8 is a straight flush, mirroring the server hand evaluator's order.
function bestHandCategory(cards: Card[]): number {
  const values = cards.map((card) => rankValue(card.rank));
  const counts = new Map<number, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const countValues = [...counts.values()].sort((left, right) => right - left);
  const flushValues = cards
    .filter((card) => cards.filter((candidate) => candidate.suit === card.suit).length >= 5)
    .map((card) => rankValue(card.rank));
  const hasFlush = flushValues.length >= 5;
  const hasStraight = straightHighCard(values) !== null;
  const hasStraightFlush = hasFlush && straightHighCard(flushValues) !== null;

  if (hasStraightFlush) {
    return 8;
  }

  if (countValues[0] === 4) {
    return 7;
  }

  if (countValues[0] === 3 && (countValues[1] ?? 0) >= 2) {
    return 6;
  }

  if (hasFlush) {
    return 5;
  }

  if (hasStraight) {
    return 4;
  }

  if (countValues[0] === 3) {
    return 3;
  }

  if (countValues[0] === 2 && (countValues[1] ?? 0) === 2) {
    return 2;
  }

  if (countValues[0] === 2) {
    return 1;
  }

  return 0;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
