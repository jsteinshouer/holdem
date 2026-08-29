// Presentation-only formatters. Nothing here decides game outcomes; the server
// owns every result and the client only renders what a snapshot already states.

const RANK_PLURALS: Record<number, string> = {
  2: "Twos",
  3: "Threes",
  4: "Fours",
  5: "Fives",
  6: "Sixes",
  7: "Sevens",
  8: "Eights",
  9: "Nines",
  10: "Tens",
  11: "Jacks",
  12: "Queens",
  13: "Kings",
  14: "Aces"
};

const RANK_SINGULARS: Record<number, string> = {
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
  11: "Jack",
  12: "Queen",
  13: "King",
  14: "Ace"
};

export function rankPlural(value: number): string {
  return RANK_PLURALS[value] ?? String(value);
}

export function rankSingular(value: number): string {
  return RANK_SINGULARS[value] ?? String(value);
}

// Money always renders with thousands separators so four- and five-figure pots
// stay scannable. Pair every use with the tabular-nums type role.
export function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatPhase(phase: string): string {
  return phase === "preflop" ? "Preflop" : `${phase[0]?.toUpperCase() ?? ""}${phase.slice(1)}`;
}

export function formatAction(action: string): string {
  return action === "all-in" ? "All-in" : `${action[0]?.toUpperCase() ?? ""}${action.slice(1)}`;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function suitSymbol(suit: "clubs" | "diamonds" | "hearts" | "spades"): string {
  return { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" }[suit];
}
