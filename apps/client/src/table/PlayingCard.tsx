import type { Card } from "@friendly-holdem/shared";
import { suitSymbol } from "../lib/format";

const PIPS_BY_RANK: Record<Card["rank"], string[]> = {
  A: ["center"],
  "2": ["top-center", "bottom-center"],
  "3": ["top-center", "center", "bottom-center"],
  "4": ["top-left", "top-right", "bottom-left", "bottom-right"],
  "5": ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
  "6": ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"],
  "7": ["top-left", "top-right", "middle-left", "middle-right", "center", "bottom-left", "bottom-right"],
  "8": ["top-left", "top-right", "upper-left", "upper-right", "lower-left", "lower-right", "bottom-left", "bottom-right"],
  "9": [
    "top-left",
    "top-right",
    "upper-left",
    "upper-right",
    "center",
    "lower-left",
    "lower-right",
    "bottom-left",
    "bottom-right"
  ],
  "10": [
    "top-left",
    "top-right",
    "upper-left",
    "upper-right",
    "middle-left",
    "middle-right",
    "lower-left",
    "lower-right",
    "bottom-left",
    "bottom-right"
  ],
  J: [],
  Q: [],
  K: []
};

// The system's fixed silhouette. Theme-invariant by rule: a card is a paper
// object, so its ground, ink and suit red hold the same value in light and dark
// while only the room around it flips.
export function PlayingCard({ card, size = "md", dealIndex }: { card: Card; size?: "sm" | "md" | "lg"; dealIndex?: number }) {
  const symbol = suitSymbol(card.suit);
  const pips = PIPS_BY_RANK[card.rank] ?? [];

  return (
    <span
      aria-label={`${card.rank} of ${card.suit}`}
      className={`card card--${size} card--${card.suit}`}
      role="img"
      style={dealIndex === undefined ? undefined : ({ "--deal-index": dealIndex } as React.CSSProperties)}
    >
      <span className="card__corner card__corner--top">
        <strong>{card.rank}</strong>
        <span>{symbol}</span>
      </span>
      {pips.length > 0 ? (
        <span aria-hidden="true" className={`card__pips card__pips--${pips.length}`}>
          {pips.map((position, index) => (
            <span className={`card__pip card__pip--${position}`} key={`${position}-${index}`}>
              {symbol}
            </span>
          ))}
        </span>
      ) : (
        <span aria-hidden="true" className="card__court">
          <span>{card.rank}</span>
          <small>{symbol}</small>
        </span>
      )}
      <span aria-hidden="true" className="card__corner card__corner--bottom">
        <strong>{card.rank}</strong>
        <span>{symbol}</span>
      </span>
    </span>
  );
}

// A face-down card. Used for opponents holding cards we are not allowed to see.
export function CardBack({ size = "sm" }: { size?: "xs" | "sm" | "md" | "lg" }) {
  return <span aria-hidden="true" className={`card card--back card--${size}`} />;
}
