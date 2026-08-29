import { evaluateHand, type Card } from "@friendly-holdem/shared";
import { rankPlural, rankSingular } from "./format";

// Names the viewer's current best five-card hand so a first-timer can read what
// they hold without knowing hand rankings by heart.
//
// This is deliberately local: it runs only over cards the viewer already holds
// legitimately (their own hole cards plus the public board), so it leaks nothing
// and needs no server change. It names a *made* hand only. It never names draws,
// never estimates equity, and never decides an outcome — the server remains the
// sole authority on who wins.
export function describeViewerHand(holeCards: Card[], board: Card[]): string | null {
  const cards = [...holeCards, ...board];

  if (holeCards.length < 2 || cards.length < 5) {
    return null;
  }

  const [category, first, second] = evaluateHand(cards);

  switch (category) {
    case 8:
      return "Straight flush";
    case 7:
      return `Four ${rankPlural(first ?? 0)}`;
    case 6:
      return `Full house, ${rankPlural(first ?? 0)} over ${rankPlural(second ?? 0)}`;
    case 5:
      return "Flush";
    case 4:
      return `Straight, ${rankSingular(first ?? 0)} high`;
    case 3:
      return `Three ${rankPlural(first ?? 0)}`;
    case 2:
      return `Two pair, ${rankPlural(first ?? 0)} and ${rankPlural(second ?? 0)}`;
    case 1:
      return `Pair of ${rankPlural(first ?? 0)}`;
    default:
      return `${rankSingular(first ?? 0)} high`;
  }
}
